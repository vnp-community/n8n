import { type IBinaryData } from 'n8n-workflow';
import { BinaryDataService } from 'n8n-core';
import { ChatHubMessageRepository } from './chat-message.repository';
import type { ChatMessageId, ChatSessionId, ChatAttachment } from '@n8n/api-types';
import type Stream from 'node:stream';
export declare class ChatHubAttachmentService {
    private readonly binaryDataService;
    private readonly messageRepository;
    private readonly maxTotalSizeBytes;
    constructor(binaryDataService: BinaryDataService, messageRepository: ChatHubMessageRepository);
    store(sessionId: ChatSessionId, messageId: ChatMessageId, attachments: ChatAttachment[]): Promise<IBinaryData[]>;
    getAttachment(sessionId: ChatSessionId, messageId: ChatMessageId, attachmentIndex: number): Promise<[
        IBinaryData,
        ({
            type: 'buffer';
            buffer: Buffer<ArrayBufferLike>;
            fileSize: number;
        } | {
            type: 'stream';
            stream: Stream.Readable;
            fileSize: number;
        })
    ]>;
    deleteAllBySessionId(sessionId: string): Promise<void>;
    deleteAll(): Promise<void>;
    deleteAttachments(attachments: IBinaryData[]): Promise<void>;
    private processAttachment;
}
