"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorkflowActiveStatusFromWorkflowData = getWorkflowActiveStatusFromWorkflowData;
function getWorkflowActiveStatusFromWorkflowData(workflowData) {
    return !!workflowData.activeVersionId || workflowData.active;
}
//# sourceMappingURL=execution.utils.js.map