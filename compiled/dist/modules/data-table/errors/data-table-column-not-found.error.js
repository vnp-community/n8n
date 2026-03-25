"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataTableColumnNotFoundError = void 0;
const n8n_workflow_1 = require("n8n-workflow");
class DataTableColumnNotFoundError extends n8n_workflow_1.UserError {
    constructor(dataTableId, columnId) {
        super(`Could not find the column '${columnId}' in the data table: ${dataTableId}`, {
            level: 'warning',
        });
    }
}
exports.DataTableColumnNotFoundError = DataTableColumnNotFoundError;
//# sourceMappingURL=data-table-column-not-found.error.js.map