import { ChatHubConversationModel, ChatSessionId } from '@n8n/api-types';
import { Logger } from '@n8n/backend-common';
import { SharedWorkflowRepository, WorkflowRepository } from '@n8n/db';
import { EntityManager } from '@n8n/typeorm';
import { IExecuteData, INode, INodeCredentials, IRunExecutionData, IWorkflowBase, type IBinaryData } from 'n8n-workflow';
import { ChatHubMessage } from './chat-hub-message.entity';
export declare class ChatHubWorkflowService {
    private readonly logger;
    private readonly workflowRepository;
    private readonly sharedWorkflowRepository;
    constructor(logger: Logger, workflowRepository: WorkflowRepository, sharedWorkflowRepository: SharedWorkflowRepository);
    createChatWorkflow(userId: string, sessionId: ChatSessionId, projectId: string, history: ChatHubMessage[], humanMessage: string, attachments: IBinaryData[], credentials: INodeCredentials, model: ChatHubConversationModel, systemMessage: string | undefined, tools: INode[], trx?: EntityManager): Promise<{
        workflowData: IWorkflowBase;
        executionData: IRunExecutionData;
    }>;
    createTitleGenerationWorkflow(userId: string, sessionId: ChatSessionId, projectId: string, humanMessage: string, credentials: INodeCredentials, model: ChatHubConversationModel, trx?: EntityManager): Promise<{
        workflowData: IWorkflowBase;
        executionData: IRunExecutionData;
    }>;
    prepareExecutionData(triggerNode: INode, sessionId: string, message: string, attachments: IBinaryData[]): IExecuteData[];
    private getUniqueNodeName;
    private buildChatWorkflow;
    private buildTitleGenerationWorkflow;
    private buildChatTriggerNode;
    private buildToolsAgentNode;
    private buildModelNode;
    private buildMemoryNode;
    private buildRestoreMemoryNode;
    private buildClearMemoryNode;
    private buildMergeNode;
    private buildTitleGeneratorAgentNode;
}
