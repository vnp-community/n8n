import { AiWorkflowBuilderService } from '@n8n/ai-workflow-builder';
import { ChatPayload } from '@n8n/ai-workflow-builder/dist/workflow-builder-agent';
import { Logger } from '@n8n/backend-common';
import { GlobalConfig } from '@n8n/config';
import { Service } from '@n8n/di';
import { AiAssistantClient } from '@n8n_io/ai-assistant-sdk';
import type { IUser } from 'n8n-workflow';

import { N8N_VERSION } from '@/constants';
import { License } from '@/license';
import { LoadNodesAndCredentials } from '@/load-nodes-and-credentials';
import { Push } from '@/push';
import { UrlService } from '@/services/url.service';

/**
 * This service wraps the actual AiWorkflowBuilderService to avoid circular dependencies.
 * Instead of extending, we're delegating to the real service which is created on-demand.
 */
@Service()
export class WorkflowBuilderService {
	private service: AiWorkflowBuilderService | undefined;

	constructor(
		private readonly loadNodesAndCredentials: LoadNodesAndCredentials,
		private readonly license: License,
		private readonly config: GlobalConfig,
		private readonly logger: Logger,
		private readonly urlService: UrlService,
		private readonly push: Push,
	) {}

	private async getService(): Promise<AiWorkflowBuilderService> {
		if (!this.service) {
			let client: AiAssistantClient | undefined;

			// Create AiAssistantClient only if baseUrl is configured AND we have valid license cert
			// Otherwise, AI Builder will use N8N_AI_ANTHROPIC_KEY directly (bypassing token auth)
			const baseUrl = this.config.aiAssistant.baseUrl;
			if (baseUrl) {
				const licenseCert = await this.license.loadCertStr();
				const consumerId = this.license.getConsumerId();

				// Only create client if we have a valid license cert (not empty and not placeholder)
				// This allows AI Builder to use API key directly when license cert is not available
				const hasValidLicenseCert =
					licenseCert &&
					licenseCert.trim() !== '' &&
					licenseCert !== 'local-ai-no-license' &&
					licenseCert !== 'unknown';

				if (hasValidLicenseCert) {
					client = new AiAssistantClient({
						licenseCert,
						consumerId,
						baseUrl,
						n8nVersion: N8N_VERSION,
					});
				}
				// If no valid license cert, client remains undefined
				// AI Builder will fall back to using N8N_AI_ANTHROPIC_KEY directly
			}

			// Create callback that uses the push service
			const onCreditsUpdated = (userId: string, creditsQuota: number, creditsClaimed: number) => {
				this.push.sendToUsers(
					{
						type: 'updateBuilderCredits',
						data: {
							creditsQuota,
							creditsClaimed,
						},
					},
					[userId],
				);
			};

			const { nodes: nodeTypeDescriptions } = this.loadNodesAndCredentials.types;

			this.service = new AiWorkflowBuilderService(
				nodeTypeDescriptions,
				client,
				this.logger,
				this.urlService.getInstanceBaseUrl(),
				onCreditsUpdated,
			);
		}

		return this.service;
	}

	async *chat(payload: ChatPayload, user: IUser, abortSignal?: AbortSignal) {
		const service = await this.getService();
		yield* service.chat(payload, user, abortSignal);
	}

	async getSessions(workflowId: string | undefined, user: IUser) {
		const service = await this.getService();
		const sessions = await service.getSessions(workflowId, user);
		return sessions;
	}

	async getSessionsMetadata(workflowId: string | undefined, user: IUser) {
		const service = await this.getService();
		const sessions = await service.getSessions(workflowId, user);
		const hasMessages = sessions.sessions.length > 0 && sessions.sessions[0].messages.length > 0;
		return { hasMessages };
	}

	async getBuilderInstanceCredits(user: IUser) {
		const service = await this.getService();
		return await service.getBuilderInstanceCredits(user);
	}
}
