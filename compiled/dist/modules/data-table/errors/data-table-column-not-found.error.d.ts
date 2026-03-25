import { UserError } from 'n8n-workflow';
export declare class DataTableColumnNotFoundError extends UserError {
    constructor(dataTableId: string, columnId: string);
}
