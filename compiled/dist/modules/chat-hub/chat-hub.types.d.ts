import type { ChatHubConversationModel, ChatHubProvider, ChatMessageId, ChatSessionId, ChatAttachment } from '@n8n/api-types';
import type { INode, INodeCredentials } from 'n8n-workflow';
import { z } from 'zod';
export interface ModelWithCredentials {
    provider: ChatHubProvider;
    model?: string;
    workflowId?: string;
    credentialId: string | null;
    agentId?: string;
    name?: string;
}
export interface BaseMessagePayload {
    userId: string;
    sessionId: ChatSessionId;
    model: ChatHubConversationModel;
    credentials: INodeCredentials;
}
export interface HumanMessagePayload extends BaseMessagePayload {
    messageId: ChatMessageId;
    message: string;
    previousMessageId: ChatMessageId | null;
    attachments: ChatAttachment[];
    tools: INode[];
    agentName: string;
}
export interface RegenerateMessagePayload extends BaseMessagePayload {
    retryId: ChatMessageId;
}
export interface EditMessagePayload extends BaseMessagePayload {
    editId: ChatMessageId;
    messageId: ChatMessageId;
    message: string;
}
export type MessageRole = 'ai' | 'system' | 'user';
export interface MessageRecord {
    type: MessageRole;
    message: string;
    hideFromUI: boolean;
}
export declare const validChatTriggerParamsShape: z.ZodObject<{
    availableInChat: z.ZodLiteral<true>;
    agentName: z.ZodOptional<z.ZodString>;
    agentDescription: z.ZodOptional<z.ZodString>;
    options: z.ZodOptional<z.ZodObject<{
        allowFileUploads: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        allowFileUploads?: boolean | undefined;
    }, {
        allowFileUploads?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    availableInChat: true;
    options?: {
        allowFileUploads?: boolean | undefined;
    } | undefined;
    agentName?: string | undefined;
    agentDescription?: string | undefined;
}, {
    availableInChat: true;
    options?: {
        allowFileUploads?: boolean | undefined;
    } | undefined;
    agentName?: string | undefined;
    agentDescription?: string | undefined;
}>;
