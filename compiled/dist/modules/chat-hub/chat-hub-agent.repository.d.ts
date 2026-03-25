import { DataSource, EntityManager, Repository } from '@n8n/typeorm';
import { ChatHubAgent } from './chat-hub-agent.entity';
export declare class ChatHubAgentRepository extends Repository<ChatHubAgent> {
    constructor(dataSource: DataSource);
    createAgent(agent: Partial<ChatHubAgent>, trx?: EntityManager): Promise<ChatHubAgent>;
    updateAgent(id: string, updates: Partial<Pick<ChatHubAgent, 'name' | 'description' | 'systemPrompt' | 'provider' | 'model' | 'credentialId'>>, trx?: EntityManager): Promise<ChatHubAgent>;
    deleteAgent(id: string, trx?: EntityManager): Promise<import("@n8n/typeorm").DeleteResult>;
    getManyByUserId(userId: string): Promise<ChatHubAgent[]>;
    getOneById(id: string, userId: string, trx?: EntityManager): Promise<ChatHubAgent | null>;
}
