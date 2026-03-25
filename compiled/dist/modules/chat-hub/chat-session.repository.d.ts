import { DataSource, EntityManager, Repository } from '@n8n/typeorm';
import { ChatHubSession } from './chat-hub-session.entity';
export declare class ChatHubSessionRepository extends Repository<ChatHubSession> {
    constructor(dataSource: DataSource);
    createChatSession(session: Partial<ChatHubSession>, trx?: EntityManager): Promise<ChatHubSession>;
    updateLastMessageAt(id: string, lastMessageAt: Date, trx?: EntityManager): Promise<ChatHubSession>;
    updateChatTitle(id: string, title: string, trx?: EntityManager): Promise<ChatHubSession>;
    updateChatSession(id: string, updates: Partial<ChatHubSession>, trx?: EntityManager): Promise<ChatHubSession>;
    deleteChatHubSession(id: string, trx?: EntityManager): Promise<import("@n8n/typeorm").DeleteResult>;
    getManyByUserId(userId: string, limit: number, cursor?: string): Promise<ChatHubSession[]>;
    getOneById(id: string, userId: string, trx?: EntityManager): Promise<ChatHubSession | null>;
    deleteAll(trx?: EntityManager): Promise<import("@n8n/typeorm").DeleteResult>;
}
