import { Logger } from '@n8n/backend-common';
import { WorkflowDependencyRepository, WorkflowRepository } from '@n8n/db';
import { ErrorReporter } from 'n8n-core';
import { IWorkflowBase } from 'n8n-workflow';
import { EventService } from '../../events/event.service';
export declare class WorkflowIndexService {
    private readonly dependencyRepository;
    private readonly workflowRepository;
    private readonly eventService;
    private readonly logger;
    private readonly errorReporter;
    private readonly batchSize;
    constructor(dependencyRepository: WorkflowDependencyRepository, workflowRepository: WorkflowRepository, eventService: EventService, logger: Logger, errorReporter: ErrorReporter, batchSize?: number);
    init(): void;
    buildIndex(): Promise<void>;
    updateIndexFor(workflow: IWorkflowBase): Promise<void>;
    private addNodeTypeDependencies;
    private addCredentialDependencies;
    private addWorkflowCallDependencies;
    private addWebhookPathDependencies;
    private getCalledWorkflowIdFrom;
}
