"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const config_1 = require("@n8n/config");
const di_1 = require("@n8n/di");
const ai_assistant_sdk_1 = require("@n8n_io/ai-assistant-sdk");
const n8n_workflow_1 = require("n8n-workflow");
const axios_1 = __importDefault(require("axios"));
const constants_1 = require("../constants");
const license_1 = require("../license");
let AiService = class AiService {
    constructor(licenseService, globalConfig) {
        this.licenseService = licenseService;
        this.globalConfig = globalConfig;
    }
    async init() {
        const aiAssistantEnabled = this.licenseService.isAiAssistantEnabled();
        if (!aiAssistantEnabled) {
            return;
        }
        const baseUrl = this.globalConfig.aiAssistant.baseUrl;
        if (!baseUrl ||
            !baseUrl.trim() ||
            (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://'))) {
            return;
        }
        const licenseCert = await this.licenseService.loadCertStr();
        const consumerId = this.licenseService.getConsumerId();
        const hasValidLicenseCert = licenseCert &&
            licenseCert.trim() !== '' &&
            licenseCert !== 'local-ai-no-license' &&
            licenseCert !== 'unknown';
        if (!hasValidLicenseCert) {
            return;
        }
        const logLevel = this.globalConfig.logging.level;
        this.client = new ai_assistant_sdk_1.AiAssistantClient({
            licenseCert,
            consumerId,
            n8nVersion: constants_1.N8N_VERSION,
            baseUrl,
            logLevel,
        });
    }
    async chat(payload, user) {
        if (!this.client) {
            await this.init();
        }
        (0, n8n_workflow_1.assert)(this.client, 'Assistant client not setup');
        return await this.client.chat(payload, { id: user.id });
    }
    async applySuggestion(payload, user) {
        if (!this.client) {
            await this.init();
        }
        (0, n8n_workflow_1.assert)(this.client, 'Assistant client not setup');
        return await this.client.applySuggestion(payload, { id: user.id });
    }
    async askAi(payload, user) {
        if (this.globalConfig.aiAssistant.externalEnabled) {
            return await this.askAiDirect(payload);
        }
        if (!this.client) {
            await this.init();
        }
        if (!this.client) {
            return await this.askAiDirect(payload);
        }
        return await this.client.askAi(payload, { id: user.id });
    }
    async askAiDirect(payload) {
        const baseUrl = this.globalConfig.aiAssistant.baseUrl;
        const apiKey = this.globalConfig.aiAssistant.externalApiKey ||
            process.env.N8N_AI_ANTHROPIC_KEY ||
            this.globalConfig.aiBuilder.apiKey;
        const modelName = this.globalConfig.aiAssistant.externalModel || process.env.N8N_AI_MODEL || 'v_chat4';
        if (!baseUrl || !apiKey) {
            throw new Error('External AI not configured. Please set N8N_AI_ASSISTANT_BASE_URL and N8N_AI_EXTERNAL_API_KEY (or N8N_AI_ANTHROPIC_KEY)');
        }
        try {
            const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
            const endpoint = `${normalizedBaseUrl}/chat/completions`;
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
            }
            else if (isTransformNode) {
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
            }
            else {
                systemPrompt = `You are a helpful AI assistant that generates code based on user questions and context.

CRITICAL OUTPUT REQUIREMENTS:
- Return ONLY the raw code
- NO markdown code blocks (no \`\`\`javascript, \`\`\`js, or \`\`\`)
- NO explanations, comments, or descriptions
- Start directly with the code statement

Remember: Output ONLY the code, nothing else.`;
            }
            let userPrompt = payload.question;
            if (payload.context?.inputSchema) {
                userPrompt += `\n\nInput schema context:\n- Node: ${payload.context.inputSchema.nodeName}\n- Schema: ${JSON.stringify(payload.context.inputSchema.schema, null, 2)}`;
            }
            if (payload.context?.schema && payload.context.schema.length > 0) {
                userPrompt += `\n\nParent nodes context:\n`;
                payload.context.schema.forEach((nodeSchema) => {
                    userPrompt += `- ${nodeSchema.nodeName}: ${JSON.stringify(nodeSchema.schema, null, 2)}\n`;
                });
            }
            const response = await axios_1.default.post(endpoint, {
                model: modelName,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.7,
                max_tokens: 1000,
            }, {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 30000,
            });
            let code = response.data?.choices?.[0]?.message?.content || '';
            if (!code) {
                throw new Error('No code generated from LLM API response');
            }
            code = this.cleanCodeResponse(code);
            if (!code || code.trim().length === 0) {
                throw new Error('Code is empty after cleaning markdown and explanations');
            }
            code = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            return { code };
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                const errorMessage = error.response?.data?.error?.message || error.message;
                const statusCode = error.response?.status;
                throw new Error(`Failed to call LLM API${statusCode ? ` (${statusCode})` : ''}: ${errorMessage}`);
            }
            throw error;
        }
    }
    cleanCodeResponse(code) {
        if (!code || typeof code !== 'string') {
            return '';
        }
        code = code.replace(/^```[\w]*\s*\n?/gm, '');
        code = code.replace(/\n?```\s*$/gm, '');
        code = code.replace(/```[\w]*\s*\n?/g, '');
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
        code = code.replace(/\n\s*(This code|The code above|This solution|Note:|Explanation:|This will|The above).*$/is, '');
        code = code.replace(/`([^`]+)`/g, '$1');
        code = code.replace(/\r\n/g, '\n');
        code = code.trim();
        code = code.replace(/\n{3,}$/, '\n\n');
        return code;
    }
    async createFreeAiCredits(user) {
        if (!this.client) {
            await this.init();
        }
        (0, n8n_workflow_1.assert)(this.client, 'Assistant client not setup');
        return await this.client.generateAiCreditsCredentials(user);
    }
};
exports.AiService = AiService;
exports.AiService = AiService = __decorate([
    (0, di_1.Service)(),
    __metadata("design:paramtypes", [license_1.License,
        config_1.GlobalConfig])
], AiService);
//# sourceMappingURL=ai.service.js.map