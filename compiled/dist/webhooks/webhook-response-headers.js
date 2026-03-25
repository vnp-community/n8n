"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookResponseHeaders = void 0;
const backend_common_1 = require("@n8n/backend-common");
const di_1 = require("@n8n/di");
const node_http_1 = require("node:http");
const n8n_workflow_1 = require("n8n-workflow");
const PROTECTED_HEADERS = new Set(['content-security-policy']);
class WebhookResponseHeaders {
    constructor() {
        this.headers = new Map();
    }
    static fromObject(obj) {
        const instance = new WebhookResponseHeaders();
        instance.addFromObject(obj);
        return instance;
    }
    set(name, value) {
        const lowerName = name.toLowerCase();
        if (PROTECTED_HEADERS.has(lowerName))
            return;
        try {
            (0, node_http_1.validateHeaderName)(lowerName);
            (0, node_http_1.validateHeaderValue)(lowerName, value);
        }
        catch (e) {
            di_1.Container.get(backend_common_1.Logger).warn('Dropping invalid webhook response header', {
                headerName: name,
                error: (0, n8n_workflow_1.ensureError)(e).message,
            });
            return;
        }
        this.headers.set(lowerName, value);
    }
    addFromObject(obj) {
        for (const [name, value] of Object.entries(obj)) {
            this.set(name, String(value));
        }
    }
    addFromNodeHeaders(nodeHeaders) {
        if (nodeHeaders.entries === undefined)
            return;
        for (const entry of nodeHeaders.entries) {
            this.set(entry.name, entry.value);
        }
    }
    applyToResponse(res) {
        if (this.headers.size === 0)
            return;
        res.setHeaders(this.headers);
    }
}
exports.WebhookResponseHeaders = WebhookResponseHeaders;
//# sourceMappingURL=webhook-response-headers.js.map