import { ChatModelsResponse } from '@n8n/api-types';
import { Logger } from '@n8n/backend-common';
import type { User } from '@n8n/db';
import { INode } from 'n8n-workflow';
import type { ChatHubAgent } from './chat-hub-agent.entity';
import { ChatHubAgentRepository } from './chat-hub-agent.repository';
import { ChatHubCredentialsService } from './chat-hub-credentials.service';
export declare class ChatHubAgentService {
    private readonly logger;
    private readonly chatAgentRepository;
    private readonly chatHubCredentialsService;
    constructor(logger: Logger, chatAgentRepository: ChatHubAgentRepository, chatHubCredentialsService: ChatHubCredentialsService);
    getAgentsByUserIdAsModels(userId: string): Promise<ChatModelsResponse['custom-agent']>;
    getAgentsByUserId(userId: string): Promise<ChatHubAgent[]>;
    getAgentById(id: string, userId: string): Promise<ChatHubAgent>;
    createAgent(user: User, data: {
        name: string;
        description?: string;
        systemPrompt: string;
        credentialId: string;
        provider: ChatHubAgent['provider'];
        model: string;
        tools: INode[];
    }): Promise<ChatHubAgent>;
    updateAgent(id: string, user: User, updates: {
        name?: string;
        description?: string;
        systemPrompt?: string;
        credentialId?: string;
        provider?: string;
        model?: string;
        tools?: INode[];
    }): Promise<ChatHubAgent>;
    deleteAgent(id: string, userId: string): Promise<void>;
}
