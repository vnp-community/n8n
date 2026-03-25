import { UserError } from 'n8n-workflow';
export declare class DataTableNotFoundError extends UserError {
    constructor(dataTableId: string);
}
