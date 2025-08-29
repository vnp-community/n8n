"use strict";

const cryptoJS = require("crypto-js");
const { machineId } = require("node-machine-id");
const NodeRSA = require("node-rsa");
const assert = require("assert");
const crypto = require("crypto");
const { fetch, ProxyAgent, getGlobalDispatcher, setGlobalDispatcher, Dispatcher } = require("undici");
const { URL } = require("url");

// Auto-renew interval
const AUTORENEWAL_INTERVAL = 15 * 60 * 1000;

// Proxy setup
function getProxy(envVar) {
    const proxy = process.env[envVar];
    return proxy ? new ProxyAgent(proxy) : null;
}

const httpProxy = getProxy("http_proxy_license_server") || getProxy("http_proxy");
const httpsProxy = getProxy("https_proxy_license_server") || getProxy("https_proxy");
const proxyMap = { ...(httpProxy ? { "http:": httpProxy } : {}), ...(httpsProxy ? { "https:": httpsProxy } : {}) };
const noProxyList = (process.env.no_proxy ?? "").split(",").map(s => s.trim());

const globalDispatcher = getGlobalDispatcher();
setGlobalDispatcher(new class extends Dispatcher {
    dispatch(req, opts) {
        if (req.origin) {
            let { host, protocol } = typeof req.origin === "string" ? new URL(req.origin) : req.origin;
            if (!noProxyList.some(n => n.startsWith(".") ? host.endsWith(n) : host === n)) {
                const proxy = proxyMap[protocol];
                if (proxy) return proxy.dispatch(req, opts);
            }
        }
        return globalDispatcher.dispatch(req, opts);
    }
})();

// HTTP POST helper
async function postJSON(url, body, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutInMs ?? 30000);
    try {
        const res = await fetch(url, {
            method: "POST",
            body: JSON.stringify(body),
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
        });
        const data = await res.json();
        return { status: res.status, data };
    } catch (err) {
        throw new Error("Connection Error", { cause: err });
    } finally {
        clearTimeout(timeout);
    }
}

// LicenseManager class
class LicenseManager {
    constructor(config) {
        this.isShuttingDown = false;
        this.config = config;

        this.logger = config.logger || {
            error: (...args) => console.log("ERROR:", ...args),
            warn: (...args) => console.log("WARN:", ...args),
            info: (...args) => console.log("INFO:", ...args),
            debug: (...args) => console.log("DEBUG:", ...args),
        };

        this.x509IssuerCert = new crypto.X509Certificate(`-----BEGIN CERTIFICATE-----
MIIFDDCCAvQCCQCWGBewlWbp0DANBgkqhkiG9w0BAQsFADBIMQswCQYDVQQGEwJE
...
-----END CERTIFICATE-----`);

        this.config.autoRenewEnabled = config.autoRenewEnabled ?? true;
        this.config.renewOnInit = config.renewOnInit ?? false;
        this.config.offlineMode = config.offlineMode ?? false;
        this.config.autoRenewOffset = config.autoRenewOffset ?? 60 * 60 * 72;
        this.config.server = config.server ?? "https://license.n8n.io/v1";
    }

    log(message, level = "info") {
        this.logger[level](`[license SDK] ${message}`);
    }

    get isInitialized() {
        return !!this.initializationPromise;
    }

    setupSingleTimer(fn, delay) { return setTimeout(fn, delay); }
    clearSingleTimer(timer) { if (timer) clearTimeout(timer); }
    setupRepeatingTimer(fn, interval) { return setInterval(fn, interval); }
    clearRepeatingTimer(timer) { if (timer) clearInterval(timer); }

    isOlderThan(date, durationMs) { return Date.now() - date.getTime() > durationMs; }

    async computeDeviceFingerprint() {
        if (this.config.deviceFingerprint && typeof this.config.deviceFingerprint === "function") {
            return await this.config.deviceFingerprint();
        }
        return await machineId();
    }

    async initialize() {
        if (this.initializationPromise) return this.initializationPromise;
        this.initializationPromise = this._doInitialization();
        return await this.initializationPromise;
    }

    async _doInitialization() {
        assert(!this.initializationPromise, "Initialization already in progress");

        this.deviceFingerprint = await this.computeDeviceFingerprint();
        this.log(`initializing for deviceFingerprint ${this.deviceFingerprint}`, "debug");

        await this.initCert();

        this.clearRepeatingTimer(this.upcomingEntitlementChangesCheckTimer);
        this.upcomingEntitlementChangesCheckTimer = this.setupRepeatingTimer(
            () => this.setTimerForNextEntitlementChange(),
            AUTORENEWAL_INTERVAL
        );

        if (this.config.renewOnInit && this.config.autoRenewEnabled && this.hasCert()) {
            if (this.licenseCert.detachedEntitlementsCount > 0 || this.isOlderThan(this.licenseCert.issuedAt, 24 * 60 * 60 * 1000)) {
                await this.renewalCron({ force: true });
            } else {
                this.log("Skipping renewal on init because cert was issued less than 24 hours ago or not initialized", "debug");
            }
        }

        if (this.config.autoRenewEnabled) {
            this.clearRepeatingTimer(this.renewalTimer);
            this.renewalTimer = this.setupRepeatingTimer(() => this.renewalCron({ force: false }), AUTORENEWAL_INTERVAL);
        }
    }

    async reset() {
        if (this.initializationPromise) await this.initializationPromise;
        this.clearRepeatingTimer(this.renewalTimer);
        this.renewalTimer = undefined;
        this.clearRepeatingTimer(this.upcomingEntitlementChangesCheckTimer);
        this.upcomingEntitlementChangesCheckTimer = undefined;
        this.clearSingleTimer(this.entitlementChangeTimer);
        this.entitlementChangeTimer = undefined;
        this.licenseCert = undefined;
        this.deviceFingerprint = undefined;
        this.initializationPromise = undefined;
    }

    async reload() {
        await this.reset();
        await this.initialize();
    }

    hasCert() { return !!this.licenseCert; }

    isTerminated() {
        if (!this.hasCert()) throw new Error("Cert is not initialized");
        return this.licenseCert.terminatesAt < new Date();
    }

    getExpiryDate() { if (!this.hasCert()) throw new Error("Cert is not initialized"); return this.licenseCert.expiresAt; }
    getTerminationDate() { if (!this.hasCert()) throw new Error("Cert is not initialized"); return this.licenseCert.terminatesAt; }

    isValid(showErrors = true) {
        const logErr = msg => { if (showErrors) this.log(msg, "error"); };
        if (!this.hasCert()) { logErr("cert is invalid because it is undefined"); return false; }
        const now = new Date();
        const c = this.licenseCert;
        if (c.expiresAt < now) { logErr("cert is invalid because it has expired"); return false; }
        if (c.terminatesAt < now) { logErr("cert is invalid because it was terminated"); return false; }
        if (c.createdAt.getTime() - 3e5 > now.getTime()) { logErr("cert is invalid because system clock is out of sync"); return false; }
        if (c.deviceLock && this.deviceFingerprint !== c.deviceFingerprint) { logErr("cert is invalid because device fingerprint does not match"); return false; }
        if (this.config.tenantId !== c.tenantId) { logErr("cert is invalid because tenant ID does not match"); return false; }
        return true;
    }

    hasFeatureEnabled(feature, requireValid = true) { return !!this.getFeatureValue(feature, requireValid); }
    hasFeatureDefined(feature, requireValid = true) { return this.getFeatureValue(feature, requireValid) !== undefined; }
    hasQuotaLeft(feature, amount) {
        const val = this.getFeatureValue(feature);
        if (val === undefined) return false;
        if (typeof val !== "number") throw new Error(`${feature} cannot be used as quota as it is not numeric`);
        return val === -1 ? true : Math.ceil(amount) < Math.ceil(val);
    }

    getFeatureValue(feature, requireValid = true) {
        if (!this.hasCert() || (requireValid && !this.isValid())) return;
        return this.getFeatures()[feature];
    }

    updateCurrentFeatures() {
        if (!this.hasCert()) return;
        const now = new Date();
        if (this.licenseCert.expiresAt < now || this.licenseCert.terminatesAt < now) this.currentFeatures = {};
        this.currentFeatures = this.licenseCert.entitlements
            .filter(e => e.validFrom <= now && e.validTo > now)
            .sort((a, b) => a.validFrom - b.validFrom)
            .reduce((acc, e) => ({ ...acc, ...e.features, ...e.featureOverrides }), {});
    }

    getFeatures() { return this.hasCert() ? this.currentFeatures ?? {} : {}; }
    getCurrentEntitlements() {
        if (!this.hasCert()) return [];
        const now = new Date();
        return this.licenseCert.entitlements.filter(e => e.validFrom <= now && e.validTo > now);
    }

    getManagementJwt() { return this.licenseCert ? this.licenseCert.managementJwt : ""; }
    getConsumerId() { return this.licenseCert?.consumerId; }

    isRenewalDue() {
        if (!this.licenseCert || this.licenseCert.isEphemeral) return false;
        const now = Date.now();
        const fifteenMinutes = 1000 * 60 * 15;
        const twentyMinutes = 1000 * 60 * 20;
        const n = this.licenseCert.expiresAt.getTime();
        const s = this.licenseCert.issuedAt.getTime();
        const t = this.licenseCert.terminatesAt.getTime();
        const o = now > n - this.config.autoRenewOffset * 1000 && now < t;
        const l = this.getCurrentEntitlements().some(e => now >= e.validTo.getTime() - fifteenMinutes && now <= e.validTo.getTime() && s < now - twentyMinutes);
        return o || l;
    }

    formatDuration(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h}h ${m}m ${s}s`;
    }

    triggerOnFeatureChangeCallback() { this.config.onFeatureChange?.(this.currentFeatures ?? {}); }

    setTimerForNextEntitlementChange() {
        if (!this.hasCert()) return;
        const now = Date.now();
        const times = new Set([this.licenseCert.expiresAt.getTime() - now, this.licenseCert.terminatesAt.getTime() - now]);
        this.licenseCert.entitlements.forEach(e => {
            times.add(e.validFrom.getTime() - now);
            times.add(e.validTo.getTime() - now);
        });
        const nextTimes = [...times].filter(t => t >= 0 && t <= AUTORENEWAL_INTERVAL).sort((a, b) => a - b);
        if (!nextTimes.length) return;
        const next = nextTimes[0];
        this.clearSingleTimer(this.entitlementChangeTimer);
        this.entitlementChangeTimer = this.setupSingleTimer(() => {
            this.updateCurrentFeatures();
            this.triggerOnFeatureChangeCallback();
            this.setTimerForNextEntitlementChange();
        }, next + 1000);
    }

    async renewalCron({ force }) {
        if (force || this.isRenewalDue()) {
            this.log("attempting license renewal", "debug");
            try { await this._renew({ cause: force ? "startup" : "auto" }); } catch {}
        }
    }

    async activate(reservationId) {
        if (!this.isInitialized) throw new Error("activation failed because SDK was not yet initialized");
        if (this.isShuttingDown) throw new Error("activation failed because SDK is shutting down");
        if (this.config.offlineMode) throw new Error("activation failed because SDK is in offline mode");

        const payload = {
            reservationId,
            tenantId: this.config.tenantId,
            productIdentifier: this.config.productIdentifier,
            deviceFingerprint: this.deviceFingerprint,
        };

        if (this.hasCert()) {
            payload.consumerId = this.licenseCert.consumerId;
            payload.renewalToken = this.licenseCert.renewalToken;
        }

        let response;
        try { response = await postJSON(`${this.config.server}/activate`, payload, { timeoutInMs: 10000 }); }
        catch (err) { this.log("license activation failed: " + err.message, "warn"); throw new Error(err.message); }

        if (response.status === 200) {
            const data = response.data;
            if (!data.hasOwnProperty("licenseKey") || !data.hasOwnProperty("x509")) {
                this.log("unexpected server response", "warn");
                throw new Error("unexpected server response");
            }
            const certStr = this.stringifyCertContainer({ licenseKey: data.licenseKey, x509: data.x509 });
            await this.config.saveCertStr(certStr);
            await this.initCert();
            this.log("license successfully activated", "info");
            if (data.detachedEntitlementsCount) {
                this.log(`skipped importing ${data.detachedEntitlementsCount} floating entitlements which are currently in use elsewhere`, "info");
            }
        } else {
            let msg = `license activation failed: ${response.data.message ?? "unknown reason"}`;
            const err = new Error(msg);
            if (response.data.errorId) err.errorId = response.data.errorId;
            this.log(msg, "warn");
            throw err;
        }
    }

    async renew() { return this._renew({ cause: "request" }); }

    async _renew({ detachFloatingEntitlements = false, cause = "unknown" } = {}) {
        if (!this.hasCert()) throw new Error("renewal failed because current cert is not initialized");
        if (this.licenseCert.isEphemeral) return;
        if (this.isTerminated()) throw new Error("renewal failed because current cert was terminated");
        if (this.config.offlineMode) throw new Error("renewal failed because SDK is in offline mode");
        if (this.config.tenantId !== this.licenseCert.tenantId) throw new Error("renewal failed because tenant ID does not match");
        if (cause !== "request" && this.licenseCert.deviceLock && this.deviceFingerprint !== this.licenseCert.deviceFingerprint) {
            throw new Error("renewal failed because device fingerprint does not match");
        }

        const usageMetrics = this.config.collectUsageMetrics ? await this.config.collectUsageMetrics() : [];
        const passthroughData = this.config.collectPassthroughData ? await this.config.collectPassthroughData() : {};

        let response;
        try {
            response = await postJSON(`${this.config.server}/renew`, {
                consumerId: this.licenseCert.consumerId,
                tenantId: this.config.tenantId,
                deviceFingerprint: this.deviceFingerprint,
                productIdentifier: this.config.productIdentifier,
                renewalToken: this.licenseCert.renewalToken,
                detachFloatingEntitlements,
                cause,
                usageMetrics,
                passthroughData
            }, { timeoutInMs: 10000 });
        } catch (err) {
            this.log("license renewal failed: " + err.message, "warn");
            throw new Error(err.message);
        }

        const data = response.data;
        if (response.status === 200) {
            if (!data.hasOwnProperty("licenseKey") || !data.hasOwnProperty("x509")) {
                this.log("license renewal failed: unexpected server response", "warn");
                throw new Error("unexpected server response");
            }
            const certStr = this.stringifyCertContainer({ licenseKey: data.licenseKey, x509: data.x509 });
            await this.config.saveCertStr(certStr);
            this.log("license successfully renewed", "debug");
            if (data.detachedEntitlementsCount) {
                this.log(`skipped importing ${data.detachedEntitlementsCount} floating entitlements which are currently in use elsewhere`, "info");
            }
            await this.initCert();
        } else {
            let msg = `license renewal failed: ${data.message ?? "unknown reason"}`;
            const err = new Error(msg);
            if (data.errorId) {
                err.errorId = data.errorId;
                if (["NOT_FOUND","CONSUMER_TERMINATED"].includes(data.errorId)) {
                    this.log("license was terminated by the server. Deleting local cert.", "warn");
                    await this.config.saveCertStr("");
                    await this.initCert();
                }
            }
            this.log(msg, "warn");
            throw err;
        }
    }

    stringifyCertContainer(cert) {
        return Buffer.from(JSON.stringify(cert)).toString("base64");
    }

    parseLicenseCertContainerStr(certStr) {
        const parsed = JSON.parse(Buffer.from(certStr, "base64").toString("ascii"));
        if (!parsed.hasOwnProperty("licenseKey") || !parsed.hasOwnProperty("x509")) {
            throw new Error("license cert container could not be parsed");
        }
        return parsed;
    }

    parseLicenseKeyStr(licenseKey) {
        const parsed = this.validateLicenseKey(licenseKey);
        parsed.createdAt = new Date(parsed.createdAt);
        parsed.issuedAt = new Date(parsed.issuedAt);
        parsed.expiresAt = new Date(parsed.expiresAt);
        parsed.terminatesAt = new Date(parsed.terminatesAt);
        parsed.detachedEntitlementsCount = parsed.detachedEntitlementsCount ?? 0;
        parsed.entitlements = parsed.entitlements.map(e => {
            e.validFrom = new Date(e.validFrom);
            e.validTo = new Date(e.validTo);
            return e;
        });
        return parsed;
    }

    validateLicenseKey(key) {
        key = key.replace(/(\r\n|\n|\r)/gm, "");
        const regex = /^-----BEGIN LICENSE KEY-----(?<encryptedSymmetricKey>.+\|\|)(?<encryptedData>.+)\|\|(?<signature>.+)-----END LICENSE KEY-----$/;
        const match = key.match(regex);
        if (!match) throw new Error("license key could not be parsed");

        const { encryptedSymmetricKey, encryptedData, signature } = match.groups;

        let symmetricKey;
        try { symmetricKey = this.key.decryptPublic(encryptedSymmetricKey, "utf8"); }
        catch { throw new Error("Invalid data: Could not extract symmetric key"); }

        let decrypted;
        try { decrypted = cryptoJS.AES.decrypt(encryptedData, symmetricKey).toString(cryptoJS.enc.Utf8); }
        catch { throw new Error("Invalid Data: Could not decrypt data with key found"); }

        if (this.key.verify(Buffer.from(decrypted), signature, "utf8", "base64")) {
            return JSON.parse(decrypted);
        }
        throw new Error("License Key signature invalid");
    }

    async shutdown() {
        this.isShuttingDown = true;
        this.clearRepeatingTimer(this.renewalTimer);
        this.clearRepeatingTimer(this.upcomingEntitlementChangesCheckTimer);
        this.clearSingleTimer(this.entitlementChangeTimer);

        if (!this.hasCert()) return;
        if (this.licenseCert.entitlements.some(e => e.isFloatable)) {
            await this._renew({ detachFloatingEntitlements: true, cause: "shutdown" });
        }
    }

    enableAutoRenewals() {
        if (!this.config.autoRenewEnabled) {
            this.config.autoRenewEnabled = true;
            this.log("License autorenewals enabled", "info");
            this.clearRepeatingTimer(this.renewalTimer);
            this.renewalTimer = this.setupRepeatingTimer(() => this.renewalCron({ force: false }), AUTORENEWAL_INTERVAL);
        }
    }

    disableAutoRenewals() {
        if (this.config.autoRenewEnabled) {
            this.config.autoRenewEnabled = false;
            this.log("License autorenewals disabled", "info");
            this.clearRepeatingTimer(this.renewalTimer);
            this.renewalTimer = undefined;
        }
    }
}

module.exports = { LicenseManager, AUTORENEWAL_INTERVAL };
