"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorkflowHistoryLicensePruneTime = getWorkflowHistoryLicensePruneTime;
exports.getWorkflowHistoryPruneTime = getWorkflowHistoryPruneTime;
const config_1 = require("@n8n/config");
const di_1 = require("@n8n/di");
function getWorkflowHistoryLicensePruneTime() {
    return -1;
}
function getWorkflowHistoryPruneTime() {
    return di_1.Container.get(config_1.GlobalConfig).workflowHistory.pruneTime;
}
//# sourceMappingURL=workflow-history-helper.js.map