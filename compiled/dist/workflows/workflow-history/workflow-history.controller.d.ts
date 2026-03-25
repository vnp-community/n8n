import { PaginationDto } from '@n8n/api-types';
import { WorkflowHistoryRequest } from '../../requests';
import { WorkflowHistoryService } from './workflow-history.service';
export declare class WorkflowHistoryController {
    private readonly historyService;
    constructor(historyService: WorkflowHistoryService);
    getList(req: WorkflowHistoryRequest.GetList, _res: Response, query: PaginationDto): Promise<Omit<import("@n8n/db").WorkflowHistory, "nodes" | "connections">[]>;
    getVersion(req: WorkflowHistoryRequest.GetVersion): Promise<import("@n8n/db").WorkflowHistory>;
}
