import { Logger } from '@n8n/backend-common';
import { GlobalConfig } from '@n8n/config';
import type { Project, User } from '@n8n/db';
import { ExecutionRepository, WorkflowRepository } from '@n8n/db';
import type { Response } from 'express';
import { ErrorReporter } from 'n8n-core';
import type { IDeferredPromise, IExecuteResponsePromiseData, INode, INodeExecutionData, IPinData, IRunExecutionData, IWorkflowExecuteAdditionalData, WorkflowExecuteMode, IWorkflowBase } from 'n8n-workflow';
import { ExecutionDataService } from '../executions/execution-data.service';
import { SubworkflowPolicyChecker } from '../executions/pre-execution-checks';
import type { IWorkflowErrorData } from '../interfaces';
import { NodeTypes } from '../node-types';
import { TestWebhooks } from '../webhooks/test-webhooks';
import { WorkflowRunner } from '../workflow-runner';
import type { WorkflowRequest } from '../workflows/workflow.request';
export declare class WorkflowExecutionService {
    private readonly logger;
    private readonly errorReporter;
    private readonly executionRepository;
    private readonly workflowRepository;
    private readonly nodeTypes;
    private readonly testWebhooks;
    private readonly workflowRunner;
    private readonly globalConfig;
    private readonly subworkflowPolicyChecker;
    private readonly executionDataService;
    constructor(logger: Logger, errorReporter: ErrorReporter, executionRepository: ExecutionRepository, workflowRepository: WorkflowRepository, nodeTypes: NodeTypes, testWebhooks: TestWebhooks, workflowRunner: WorkflowRunner, globalConfig: GlobalConfig, subworkflowPolicyChecker: SubworkflowPolicyChecker, executionDataService: ExecutionDataService);
    runWorkflow(workflowData: IWorkflowBase, node: INode, data: INodeExecutionData[][], additionalData: IWorkflowExecuteAdditionalData, mode: WorkflowExecuteMode, responsePromise?: IDeferredPromise<IExecuteResponsePromiseData>): Promise<string>;
    private isDestinationNodeATrigger;
    executeManually(payload: WorkflowRequest.ManualRunPayload, user: User, pushRef?: string): Promise<{
        executionId: string;
    } | {
        waitingForWebhook: boolean;
    }>;
    executeChatWorkflow(workflowData: IWorkflowBase, executionData: IRunExecutionData, user: User, httpResponse?: Response, streamingEnabled?: boolean, executionMode?: WorkflowExecuteMode): Promise<{
        executionId: string;
    }>;
    executeErrorWorkflow(workflowId: string, workflowErrorData: IWorkflowErrorData, runningProject: Project): Promise<void>;
    selectPinnedTrigger(workflow: IWorkflowBase, destinationNode: string, pinData: IPinData): INode | undefined;
    private findAllPinnedTriggers;
    private partialExecutionFulfilsPreconditions;
}
