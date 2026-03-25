import { ChatHubProvider } from '@n8n/api-types';
import { WithTimestamps, User, CredentialsEntity, WorkflowEntity } from '@n8n/db';
import { type Relation } from '@n8n/typeorm';
import type { INode } from 'n8n-workflow';
import type { ChatHubMessage } from './chat-hub-message.entity';
export declare class ChatHubSession extends WithTimestamps {
    id: string;
    title: string;
    ownerId: string;
    owner?: Relation<User>;
    lastMessageAt: Date | null;
    credentialId: string | null;
    credential?: Relation<CredentialsEntity> | null;
    provider: ChatHubProvider | null;
    model: string | null;
    workflowId: string | null;
    workflow?: Relation<WorkflowEntity> | null;
    agentId: string | null;
    agentName: string | null;
    messages?: Array<Relation<ChatHubMessage>>;
    tools: INode[];
}
