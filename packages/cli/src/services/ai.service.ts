import type {
	AiApplySuggestionRequestDto,
	AiAskRequestDto,
	AiChatRequestDto,
} from '@n8n/api-types';
import { GlobalConfig } from '@n8n/config';
import { Service } from '@n8n/di';
import { AiAssistantClient, type AiAssistantSDK } from '@n8n_io/ai-assistant-sdk';
import { assert, type IUser } from 'n8n-workflow';
import axios from 'axios';

import { N8N_VERSION } from '../constants';
import { License } from '../license';

@Service()
export class AiService {
	private client: AiAssistantClient | undefined;

	constructor(
		private readonly licenseService: License,
		private readonly globalConfig: GlobalConfig,
	) {}

	async init() {
		const aiAssistantEnabled = this.licenseService.isAiAssistantEnabled();

		if (!aiAssistantEnabled) {
			return;
		}

		const baseUrl = this.globalConfig.aiAssistant.baseUrl;
		// Validate baseUrl - must be a valid URL (not empty and must have protocol)
		if (
			!baseUrl ||
			!baseUrl.trim() ||
			(!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://'))
		) {
			return;
		}

		const licenseCert = await this.licenseService.loadCertStr();
		const consumerId = this.licenseService.getConsumerId();

		// Only initialize client if we have a valid license cert
		// For local AI services without license, don't initialize client to avoid auth errors
		const hasValidLicenseCert =
			licenseCert &&
			licenseCert.trim() !== '' &&
			licenseCert !== 'local-ai-no-license' &&
			licenseCert !== 'unknown';

		if (!hasValidLicenseCert) {
			// Don't initialize client for local AI without license cert
			// This prevents "Could not retrieve access token" errors
			return;
		}

		const logLevel = this.globalConfig.logging.level;

		this.client = new AiAssistantClient({
			licenseCert,
			consumerId,
			n8nVersion: N8N_VERSION,
			baseUrl,
			logLevel,
		});
	}

	async chat(payload: AiChatRequestDto, user: IUser) {
		if (!this.client) {
			await this.init();
		}
		assert(this.client, 'Assistant client not setup');

		return await this.client.chat(payload, { id: user.id });
	}

	async applySuggestion(payload: AiApplySuggestionRequestDto, user: IUser) {
		if (!this.client) {
			await this.init();
		}
		assert(this.client, 'Assistant client not setup');

		return await this.client.applySuggestion(payload, { id: user.id });
	}

	async askAi(payload: AiAskRequestDto, user: IUser): Promise<AiAssistantSDK.AskAiResponsePayload> {
		// Check if external AI is enabled via config
		if (this.globalConfig.aiAssistant.externalEnabled) {
			return await this.askAiDirect(payload);
		}

		if (!this.client) {
			await this.init();
		}

		// If no client (no valid license cert), try direct LLM API call
		if (!this.client) {
			return await this.askAiDirect(payload);
		}

		return await this.client.askAi(payload, { id: user.id });
	}

	private async askAiDirect(
		payload: AiAskRequestDto,
	): Promise<AiAssistantSDK.AskAiResponsePayload> {
		// Use environment variables from config
		const baseUrl = this.globalConfig.aiAssistant.baseUrl;
		const apiKey =
			this.globalConfig.aiAssistant.externalApiKey ||
			process.env.N8N_AI_ANTHROPIC_KEY ||
			this.globalConfig.aiBuilder.apiKey;
		const modelName =
			this.globalConfig.aiAssistant.externalModel || process.env.N8N_AI_MODEL || 'v_chat4';

		if (!baseUrl || !apiKey) {
			throw new Error(
				'External AI not configured. Please set N8N_AI_ASSISTANT_BASE_URL and N8N_AI_EXTERNAL_API_KEY (or N8N_AI_ANTHROPIC_KEY)',
			);
		}

		try {
			// Call OpenAI-compatible API endpoint
			// Normalize baseUrl and append /chat/completions
			const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
			const endpoint = `${normalizedBaseUrl}/chat/completions`;

			// Build system prompt based on forNode type and context (matching SDK behavior)
			// Always build systemMessage like SDK, don't use JSON config
			const isCodeNode = payload.forNode === 'code';
			const isTransformNode = payload.forNode === 'transform';

			let systemPrompt = '';
			if (isCodeNode) {
				systemPrompt = `You are an expert JavaScript/TypeScript developer specializing in n8n Code nodes.
Your task is to generate clean, efficient code based on the user's question and the workflow context.

CRITICAL OUTPUT REQUIREMENTS:
- Return ONLY the raw JavaScript/TypeScript code
- NO markdown code blocks (no \`\`\`javascript, \`\`\`js, \`\`\`typescript, or \`\`\`)
- NO explanations, comments, or descriptions before or after the code
- NO text like "Here's the code:" or "Here is the solution:"
- Start directly with the code statement
- The code should be valid JavaScript/TypeScript that can run in n8n Code node
- Use n8n's built-in methods: $input.all(), $input.first(), $input.item, $json, etc.
- Access data from previous nodes using expressions like $json.fieldName
- Handle errors appropriately
- Return the result that should be passed to the next node

Example of CORRECT output:
const inputDate = new Date();
inputDate.setDate(inputDate.getDate() + 1);
return { date: inputDate.toISOString() };

Example of WRONG output:
\`\`\`javascript
const inputDate = new Date();
inputDate.setDate(inputDate.getDate() + 1);
return { date: inputDate.toISOString() };
\`\`\`

Remember: Output ONLY the code, nothing else.`;
			} else if (isTransformNode) {
				systemPrompt = `You are an expert in data transformation for n8n workflows.
Your task is to generate transformation code based on the user's question and the input/output schema.

CRITICAL OUTPUT REQUIREMENTS:
- Return ONLY the raw transformation code
- NO markdown code blocks (no \`\`\`javascript, \`\`\`js, or \`\`\`)
- NO explanations, comments, or descriptions
- Start directly with the code statement
- The code should transform input data according to the schema structure
- Use n8n's data access methods: $input.all(), $input.first(), $json, etc.
- Ensure the output matches the expected schema structure

Remember: Output ONLY the code, nothing else.`;
			} else {
				systemPrompt = `You are a helpful AI assistant that generates code based on user questions and context.

CRITICAL OUTPUT REQUIREMENTS:
- Return ONLY the raw code
- NO markdown code blocks (no \`\`\`javascript, \`\`\`js, or \`\`\`)
- NO explanations, comments, or descriptions
- Start directly with the code statement

Remember: Output ONLY the code, nothing else.`;
			}

			// Build user prompt with context information (similar to SDK)
			let userPrompt = payload.question;

			// Add context about input schema if available
			if (payload.context?.inputSchema) {
				userPrompt += `\n\nInput schema context:\n- Node: ${payload.context.inputSchema.nodeName}\n- Schema: ${JSON.stringify(payload.context.inputSchema.schema, null, 2)}`;
			}

			// Add context about parent nodes schema if available
			if (payload.context?.schema && payload.context.schema.length > 0) {
				userPrompt += `\n\nParent nodes context:\n`;
				payload.context.schema.forEach((nodeSchema) => {
					userPrompt += `- ${nodeSchema.nodeName}: ${JSON.stringify(nodeSchema.schema, null, 2)}\n`;
				});
			}

			const response = await axios.post(
				endpoint,
				{
					model: modelName,
					messages: [
						{ role: 'system', content: systemPrompt },
						{ role: 'user', content: userPrompt },
					],
					temperature: 0.7,
					max_tokens: 1000,
				},
				{
					headers: {
						Authorization: `Bearer ${apiKey}`,
						'Content-Type': 'application/json',
					},
					timeout: 30000, // 30 seconds timeout
				},
			);

			// Extract code from response (OpenAI format: choices[0].message.content)
			let code = response.data?.choices?.[0]?.message?.content || '';

			if (!code) {
				throw new Error('No code generated from LLM API response');
			}

			// Clean code: remove markdown code blocks and extra text (matching SDK behavior)
			code = this.cleanCodeResponse(code);

			// Ensure code is not empty after cleaning
			if (!code || code.trim().length === 0) {
				throw new Error('Code is empty after cleaning markdown and explanations');
			}

			// Normalize newlines to ensure consistent formatting (matching SDK behavior)
			code = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

			// Return in same format as SDK: { code: string }
			return { code };
		} catch (error) {
			if (axios.isAxiosError(error)) {
				const errorMessage = error.response?.data?.error?.message || error.message;
				const statusCode = error.response?.status;
				throw new Error(
					`Failed to call LLM API${statusCode ? ` (${statusCode})` : ''}: ${errorMessage}`,
				);
			}
			throw error;
		}
	}

	/**
	 * Clean code response by removing markdown code blocks and explanations
	 * Matches SDK behavior to ensure consistent code output
	 */
	private cleanCodeResponse(code: string): string {
		if (!code || typeof code !== 'string') {
			return '';
		}

		// Remove markdown code blocks (```javascript, ```js, ```typescript, ```, etc.)
		// Handle both opening and closing code blocks
		code = code.replace(/^```[\w]*\s*\n?/gm, '');
		code = code.replace(/\n?```\s*$/gm, '');
		code = code.replace(/```[\w]*\s*\n?/g, '');

		// Remove common prefixes that LLMs might add
		const prefixesToRemove = [
			/^Here's the code:\s*/i,
			/^Here is the code:\s*/i,
			/^Here's your code:\s*/i,
			/^Here is your code:\s*/i,
			/^The code is:\s*/i,
			/^Code:\s*/i,
			/^Solution:\s*/i,
			/^Here's the solution:\s*/i,
			/^Here is the solution:\s*/i,
			/^Here you go:\s*/i,
			/^Here's how:\s*/i,
		];

		for (const prefix of prefixesToRemove) {
			code = code.replace(prefix, '');
		}

		// Remove trailing explanations (common patterns)
		// Look for patterns like "This code..." or "The code above..." at the end
		code = code.replace(
			/\n\s*(This code|The code above|This solution|Note:|Explanation:|This will|The above).*$/is,
			'',
		);

		// Remove any remaining markdown formatting
		code = code.replace(/`([^`]+)`/g, '$1'); // Remove inline code backticks

		// Normalize line endings and trim
		code = code.replace(/\r\n/g, '\n'); // Normalize Windows line endings
		code = code.trim();

		// Remove excessive blank lines at the end (keep max 1 trailing newline)
		code = code.replace(/\n{3,}$/, '\n\n');

		return code;
	}

	async createFreeAiCredits(user: IUser) {
		if (!this.client) {
			await this.init();
		}
		assert(this.client, 'Assistant client not setup');

		return await this.client.generateAiCreditsCredentials(user);
	}
}
