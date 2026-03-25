"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataTableNotFoundError = void 0;
const n8n_workflow_1 = require("n8n-workflow");
class DataTableNotFoundError extends n8n_workflow_1.UserError {
    constructor(dataTableId) {
        super(`Could not find the data table: '${dataTableId}'`, {
            level: 'warning',
        });
    }
}
exports.DataTableNotFoundError = DataTableNotFoundError;
//# sourceMappingURL=data-table-not-found.error.js.map