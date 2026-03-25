import { ChatHubLLMProvider } from '@n8n/api-types';
import { type User, ProjectRepository } from '@n8n/db';
import { SharedWorkflowRepository } from '@n8n/db';
import type { EntityManager } from '@n8n/typeorm';
import type { INodeCredentials } from 'n8n-workflow';
import { CredentialsService } from '../../credentials/credentials.service';
export declare class ChatHubCredentialsService {
    private readonly credentialsService;
    private readonly projectRepository;
    private readonly sharedWorkflowRepository;
    constructor(credentialsService: CredentialsService, projectRepository: ProjectRepository, sharedWorkflowRepository: SharedWorkflowRepository);
    ensureCredentials(user: User, provider: ChatHubLLMProvider, credentials: INodeCredentials, trx?: EntityManager): Promise<{
        id: string;
        projectId: string;
    }>;
    ensureCredentialById(user: User, credentialId: string, trx?: EntityManager): Promise<{
        id: string;
        projectId: string;
    }>;
    private pickCredentialId;
    ensureWorkflowCredentials(provider: ChatHubLLMProvider, credentials: INodeCredentials, workflowId: string): Promise<{
        id: string;
        projectId: string;
    }>;
}
