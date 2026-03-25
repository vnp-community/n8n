import { ChatPayload } from '@n8n/ai-workflow-builder/dist/workflow-builder-agent';
import { Logger } from '@n8n/backend-common';
import { GlobalConfig } from '@n8n/config';
import { InstanceSettings } from 'n8n-core';
import type { IUser } from 'n8n-workflow';
import { License } from '../license';
import { LoadNodesAndCredentials } from '../load-nodes-and-credentials';
import { Push } from '../push';
import { UrlService } from '../services/url.service';
import { Telemetry } from '../telemetry';
export declare class WorkflowBuilderService {
    private readonly loadNodesAndCredentials;
    private readonly license;
    private readonly config;
    private readonly logger;
    private readonly urlService;
    private readonly push;
    private readonly telemetry;
    private readonly instanceSettings;
    private service;
    constructor(loadNodesAndCredentials: LoadNodesAndCredentials, license: License, config: GlobalConfig, logger: Logger, urlService: UrlService, push: Push, telemetry: Telemetry, instanceSettings: InstanceSettings);
    private getService;
    chat(payload: ChatPayload, user: IUser, abortSignal?: AbortSignal): AsyncGenerator<import("@n8n/ai-workflow-builder").StreamOutput, void, unknown>;
    getSessions(workflowId: string | undefined, user: IUser): Promise<{
        sessions: import("@n8n/ai-workflow-builder/dist/types/sessions").Session[];
    }>;
    getSessionsMetadata(workflowId: string | undefined, user: IUser): Promise<{
        hasMessages: boolean;
    }>;
    getBuilderInstanceCredits(user: IUser): Promise<import("@n8n_io/ai-assistant-sdk").AiAssistantSDK.BuilderInstanceCreditsResponse>;
}
