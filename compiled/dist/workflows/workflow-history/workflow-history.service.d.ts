import { Logger } from '@n8n/backend-common';
import type { User, WorkflowHistoryUpdate } from '@n8n/db';
import { WorkflowHistory, WorkflowHistoryRepository } from '@n8n/db';
import type { EntityManager } from '@n8n/typeorm';
import type { IWorkflowBase } from 'n8n-workflow';
import { WorkflowFinderService } from '../workflow-finder.service';
export declare class WorkflowHistoryService {
    private readonly logger;
    private readonly workflowHistoryRepository;
    private readonly workflowFinderService;
    constructor(logger: Logger, workflowHistoryRepository: WorkflowHistoryRepository, workflowFinderService: WorkflowFinderService);
    getList(user: User, workflowId: string, take: number, skip: number): Promise<Array<Omit<WorkflowHistory, 'nodes' | 'connections'>>>;
    getVersion(user: User, workflowId: string, versionId: string, settings?: {
        includePublishHistory?: boolean;
    }): Promise<WorkflowHistory>;
    findVersion(workflowId: string, versionId: string): Promise<WorkflowHistory | null>;
    saveVersion(user: User | string, workflow: IWorkflowBase, workflowId: string, transactionManager?: EntityManager): Promise<void>;
    updateVersion(versionId: string, workflowId: string, updateData: WorkflowHistoryUpdate): Promise<void>;
}
