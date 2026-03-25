import { DataTableCreateColumnSchema } from '@n8n/api-types';
import { DataSource, EntityManager, Repository } from '@n8n/typeorm';
import { DataTableColumn } from './data-table-column.entity';
import { DataTableDDLService } from './data-table-ddl.service';
export declare class DataTableColumnRepository extends Repository<DataTableColumn> {
    private ddlService;
    constructor(dataSource: DataSource, ddlService: DataTableDDLService);
    getColumns(dataTableId: string, trx?: EntityManager): Promise<DataTableColumn[]>;
    addColumn(dataTableId: string, schema: DataTableCreateColumnSchema, trx?: EntityManager): Promise<DataTableColumn>;
    deleteColumn(dataTableId: string, column: DataTableColumn, trx?: EntityManager): Promise<void>;
    moveColumn(dataTableId: string, column: DataTableColumn, targetIndex: number, trx?: EntityManager): Promise<void>;
    shiftColumns(dataTableId: string, lowestIndex: number, delta: -1 | 1, trx?: EntityManager): Promise<void>;
}
