import type { AiApplySuggestionRequestDto, AiAskRequestDto, AiChatRequestDto } from '@n8n/api-types';
import { GlobalConfig } from '@n8n/config';
import { type AiAssistantSDK } from '@n8n_io/ai-assistant-sdk';
import { type IUser } from 'n8n-workflow';
import { License } from '../license';
export declare class AiService {
    private readonly licenseService;
    private readonly globalConfig;
    private client;
    constructor(licenseService: License, globalConfig: GlobalConfig);
    init(): Promise<void>;
    chat(payload: AiChatRequestDto, user: IUser): Promise<Response>;
    applySuggestion(payload: AiApplySuggestionRequestDto, user: IUser): Promise<AiAssistantSDK.ApplySuggestionResponse>;
    askAi(payload: AiAskRequestDto, user: IUser): Promise<AiAssistantSDK.AskAiResponsePayload>;
    private askAiDirect;
    private cleanCodeResponse;
    createFreeAiCredits(user: IUser): Promise<AiAssistantSDK.AiCreditResponsePayload>;
}
