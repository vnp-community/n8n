import { Config, Env } from '../decorators';

@Config
export class AiAssistantConfig {
	/** Base URL of the AI assistant service */
	@Env('N8N_AI_ASSISTANT_BASE_URL')
	baseUrl: string = '';

	/** API Key for external AI service (OpenAI-compatible) */
	@Env('N8N_AI_EXTERNAL_API_KEY')
	externalApiKey: string = '';

	/** Model name for external AI service */
	@Env('N8N_AI_EXTERNAL_MODEL')
	externalModel: string = 'v_chat4';

	/** Enable external AI (bypass SDK) */
	@Env('N8N_AI_EXTERNAL_ENABLED')
	externalEnabled: boolean = false;
}
