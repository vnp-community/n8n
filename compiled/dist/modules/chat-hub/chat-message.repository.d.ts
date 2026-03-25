import type { ChatHubMessageStatus, ChatMessageId, ChatSessionId } from '@n8n/api-types';
import { DataSource, EntityManager, Repository } from '@n8n/typeorm';
import { ChatHubMessage } from './chat-hub-message.entity';
import { ChatHubSessionRepository } from './chat-session.repository';
import { type IBinaryData } from 'n8n-workflow';
import { QueryDeepPartialEntity } from '@n8n/typeorm/query-builder/QueryPartialEntity';
export declare class ChatHubMessageRepository extends Repository<ChatHubMessage> {
    private chatSessionRepository;
    constructor(dataSource: DataSource, chatSessionRepository: ChatHubSessionRepository);
    createChatMessage(message: QueryDeepPartialEntity<ChatHubMessage>, trx?: EntityManager): Promise<ChatHubMessage>;
    updateChatMessage(id: ChatMessageId, fields: {
        status?: ChatHubMessageStatus;
        content?: string;
        attachments?: IBinaryData[];
    }, trx?: EntityManager): Promise<import("@n8n/typeorm").UpdateResult>;
    deleteChatMessage(id: ChatMessageId, trx?: EntityManager): Promise<import("@n8n/typeorm").DeleteResult>;
    getManyBySessionId(sessionId: string, trx?: EntityManager): Promise<ChatHubMessage[]>;
    getOneById(id: ChatMessageId, sessionId: ChatSessionId, relations?: string[], trx?: EntityManager): Promise<ChatHubMessage | null>;
}
