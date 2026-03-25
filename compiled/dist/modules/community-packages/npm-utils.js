"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyIntegrity = verifyIntegrity;
exports.checkIfVersionExistsOrThrow = checkIfVersionExistsOrThrow;
const axios_1 = __importDefault(require("axios"));
const n8n_workflow_1 = require("n8n-workflow");
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const asyncExecFile = (0, node_util_1.promisify)(node_child_process_1.execFile);
const REQUEST_TIMEOUT = 30000;
function isDnsError(error) {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('getaddrinfo') || message.includes('ENOTFOUND');
}
function isNpmError(error) {
    const message = error instanceof Error ? error.message : String(error);
    return (message.includes('npm ERR!') ||
        message.includes('E404') ||
        message.includes('404 Not Found') ||
        message.includes('ENOTFOUND'));
}
function sanitizeRegistryUrl(registryUrl) {
    return registryUrl.replace(/\/+$/, '');
}
async function verifyIntegrity(packageName, version, registryUrl, expectedIntegrity) {
    const url = `${sanitizeRegistryUrl(registryUrl)}/${encodeURIComponent(packageName)}`;
    try {
        const metadata = await axios_1.default.get(`${url}/${version}`, {
            timeout: REQUEST_TIMEOUT,
        });
        const integrity = metadata?.data?.dist?.integrity;
        if (integrity !== expectedIntegrity) {
            throw new n8n_workflow_1.UnexpectedError('Checksum verification failed. Package integrity does not match.');
        }
        return;
    }
    catch (error) {
        try {
            const { stdout } = await asyncExecFile('npm', [
                'view',
                `${packageName}@${version}`,
                'dist.integrity',
                `--registry=${sanitizeRegistryUrl(registryUrl)}`,
                '--json',
            ]);
            const integrity = (0, n8n_workflow_1.jsonParse)(stdout);
            if (integrity !== expectedIntegrity) {
                throw new n8n_workflow_1.UnexpectedError('Checksum verification failed. Package integrity does not match.');
            }
            return;
        }
        catch (cliError) {
            if (isDnsError(cliError) || isNpmError(cliError)) {
                throw new n8n_workflow_1.UnexpectedError('Checksum verification failed. Please check your network connection and try again.');
            }
            throw new n8n_workflow_1.UnexpectedError('Checksum verification failed');
        }
    }
}
async function checkIfVersionExistsOrThrow(packageName, version, registryUrl) {
    const url = `${sanitizeRegistryUrl(registryUrl)}/${encodeURIComponent(packageName)}`;
    try {
        await axios_1.default.get(`${url}/${version}`, { timeout: REQUEST_TIMEOUT });
        return true;
    }
    catch (error) {
        try {
            const { stdout } = await asyncExecFile('npm', [
                'view',
                `${packageName}@${version}`,
                'version',
                `--registry=${sanitizeRegistryUrl(registryUrl)}`,
                '--json',
            ]);
            const versionInfo = (0, n8n_workflow_1.jsonParse)(stdout);
            if (versionInfo === version) {
                return true;
            }
            throw new n8n_workflow_1.UnexpectedError('Failed to check package version existence');
        }
        catch (cliError) {
            const message = cliError instanceof Error ? cliError.message : String(cliError);
            if (message.includes('E404') || message.includes('404 Not Found')) {
                throw new n8n_workflow_1.UnexpectedError('Package version does not exist');
            }
            if (isDnsError(cliError) || isNpmError(cliError)) {
                throw new n8n_workflow_1.UnexpectedError('The community nodes service is temporarily unreachable. Please try again later.');
            }
            throw new n8n_workflow_1.UnexpectedError('Failed to check package version existence');
        }
    }
}
//# sourceMappingURL=npm-utils.js.map