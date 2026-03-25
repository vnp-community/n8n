import { ChatHubProvider } from '@n8n/api-types';
import { WithTimestamps, User, CredentialsEntity } from '@n8n/db';
import { INode } from 'n8n-workflow';
export declare class ChatHubAgent extends WithTimestamps {
    id: string;
    name: string;
    description: string | null;
    systemPrompt: string;
    ownerId: string;
    owner?: User;
    credentialId: string | null;
    credential?: CredentialsEntity | null;
    provider: ChatHubProvider;
    model: string;
    tools: INode[];
}
