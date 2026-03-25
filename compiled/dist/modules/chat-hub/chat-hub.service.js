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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatHubService = void 0;
const api_types_1 = require("@n8n/api-types");
const backend_common_1 = require("@n8n/backend-common");
const db_1 = require("@n8n/db");
const di_1 = require("@n8n/di");
const n8n_core_1 = require("n8n-core");
const n8n_workflow_1 = require("n8n-workflow");
const chat_hub_agent_service_1 = require("./chat-hub-agent.service");
const chat_hub_credentials_service_1 = require("./chat-hub-credentials.service");
const chat_hub_workflow_service_1 = require("./chat-hub-workflow.service");
const chat_hub_attachment_service_1 = require("./chat-hub.attachment.service");
const chat_hub_constants_1 = require("./chat-hub.constants");
const chat_hub_settings_service_1 = require("./chat-hub.settings.service");
const chat_hub_types_1 = require("./chat-hub.types");
const chat_message_repository_1 = require("./chat-message.repository");
const chat_session_repository_1 = require("./chat-session.repository");
const stream_capturer_1 = require("./stream-capturer");
const active_executions_1 = require("../../active-executions");
const credentials_finder_service_1 = require("../../credentials/credentials-finder.service");
const bad_request_error_1 = require("../../errors/response-errors/bad-request.error");
const not_found_error_1 = require("../../errors/response-errors/not-found.error");
const execution_service_1 = require("../../executions/execution.service");
const dynamic_node_parameters_service_1 = require("../../services/dynamic-node-parameters.service");
const workflow_execute_additional_data_1 = require("../../workflow-execute-additional-data");
const workflow_execution_service_1 = require("../../workflows/workflow-execution.service");
const workflow_finder_service_1 = require("../../workflows/workflow-finder.service");
const workflow_service_1 = require("../../workflows/workflow.service");
let ChatHubService = class ChatHubService {
    constructor(logger, errorReporter, executionService, nodeParametersService, executionRepository, workflowExecutionService, workflowService, workflowFinderService, workflowRepository, activeExecutions, sessionRepository, messageRepository, credentialsFinderService, chatHubAgentService, chatHubCredentialsService, chatHubWorkflowService, chatHubSettingsService, chatHubAttachmentService) {
        this.logger = logger;
        this.errorReporter = errorReporter;
        this.executionService = executionService;
        this.nodeParametersService = nodeParametersService;
        this.executionRepository = executionRepository;
        this.workflowExecutionService = workflowExecutionService;
        this.workflowService = workflowService;
        this.workflowFinderService = workflowFinderService;
        this.workflowRepository = workflowRepository;
        this.activeExecutions = activeExecutions;
        this.sessionRepository = sessionRepository;
        this.messageRepository = messageRepository;
        this.credentialsFinderService = credentialsFinderService;
        this.chatHubAgentService = chatHubAgentService;
        this.chatHubCredentialsService = chatHubCredentialsService;
        this.chatHubWorkflowService = chatHubWorkflowService;
        this.chatHubSettingsService = chatHubSettingsService;
        this.chatHubAttachmentService = chatHubAttachmentService;
    }
    async getModels(user, credentialIds) {
        const additionalData = await (0, workflow_execute_additional_data_1.getBase)({ userId: user.id });
        const providers = api_types_1.chatHubProviderSchema.options;
        const allCredentials = await this.credentialsFinderService.findCredentialsForUser(user, [
            'credential:read',
        ]);
        const responses = await Promise.all(providers.map(async (provider) => {
            const credentials = {};
            if (provider !== 'n8n' && provider !== 'custom-agent') {
                const credentialId = credentialIds[provider];
                if (!credentialId) {
                    return [provider, { models: [] }];
                }
                if (!allCredentials.some((credential) => credential.id === credentialId)) {
                    return [
                        provider,
                        { models: [], error: 'Could not retrieve models. Verify credentials.' },
                    ];
                }
                credentials[api_types_1.PROVIDER_CREDENTIAL_TYPE_MAP[provider]] = { name: '', id: credentialId };
            }
            try {
                return [
                    provider,
                    await this.fetchModelsForProvider(user, provider, credentials, additionalData),
                ];
            }
            catch {
                return [
                    provider,
                    { models: [], error: 'Could not retrieve models. Verify credentials.' },
                ];
            }
        }));
        return responses.reduce((acc, [provider, res]) => {
            acc[provider] = res;
            return acc;
        }, { ...api_types_1.emptyChatModelsResponse });
    }
    async fetchModelsForProvider(user, provider, credentials, additionalData) {
        switch (provider) {
            case 'openai':
                return await this.fetchOpenAiModels(credentials, additionalData);
            case 'anthropic':
                return await this.fetchAnthropicModels(credentials, additionalData);
            case 'google':
                return await this.fetchGoogleModels(credentials, additionalData);
            case 'ollama':
                return await this.fetchOllamaModels(credentials, additionalData);
            case 'azureOpenAi':
            case 'azureEntraId':
                return this.fetchAzureOpenAiModels(credentials, additionalData);
            case 'awsBedrock':
                return await this.fetchAwsBedrockModels(credentials, additionalData);
            case 'vercelAiGateway':
                return await this.fetchVercelAiGatewayModels(credentials, additionalData);
            case 'xAiGrok':
                return await this.fetchXAiGrokModels(credentials, additionalData);
            case 'groq':
                return await this.fetchGroqModels(credentials, additionalData);
            case 'openRouter':
                return await this.fetchOpenRouterModels(credentials, additionalData);
            case 'deepSeek':
                return await this.fetchDeepSeekModels(credentials, additionalData);
            case 'cohere':
                return await this.fetchCohereModels(credentials, additionalData);
            case 'mistralCloud':
                return await this.fetchMistralCloudModels(credentials, additionalData);
            case 'n8n':
                return await this.fetchAgentWorkflowsAsModels(user);
            case 'custom-agent':
                return await this.chatHubAgentService.getAgentsByUserIdAsModels(user.id);
        }
    }
    async fetchOpenAiModels(credentials, additionalData) {
        const resourceLocatorResults = await this.nodeParametersService.getResourceLocatorResults('searchModels', 'parameters.model', additionalData, chat_hub_constants_1.PROVIDER_NODE_TYPE_MAP.openai, {}, credentials);
        return {
            models: resourceLocatorResults.results.map((result) => ({
                name: result.name,
                description: result.description ?? null,
                model: {
                    provider: 'openai',
                    model: String(result.value),
                },
                createdAt: null,
                updatedAt: null,
                allowFileUploads: true,
            })),
        };
    }
    async fetchAnthropicModels(credentials, additionalData) {
        const resourceLocatorResults = await this.nodeParametersService.getResourceLocatorResults('searchModels', 'parameters.model', additionalData, chat_hub_constants_1.PROVIDER_NODE_TYPE_MAP.anthropic, {}, credentials);
        return {
            models: resourceLocatorResults.results.map((result) => ({
                name: result.name,
                description: result.description ?? null,
                model: {
                    provider: 'anthropic',
                    model: String(result.value),
                },
                createdAt: null,
                updatedAt: null,
                allowFileUploads: true,
            })),
        };
    }
    async fetchGoogleModels(credentials, additionalData) {
        const results = await this.nodeParametersService.getOptionsViaLoadOptions({
            routing: {
                request: {
                    method: 'GET',
                    url: '/v1beta/models',
                },
                output: {
                    postReceive: [
                        {
                            type: 'rootProperty',
                            properties: {
                                property: 'models',
                            },
                        },
                        {
                            type: 'filter',
                            properties: {
                                pass: "={{ !$responseItem.name.includes('embedding') }}",
                            },
                        },
                        {
                            type: 'setKeyValue',
                            properties: {
                                name: '={{$responseItem.name}}',
                                value: '={{$responseItem.name}}',
                                description: '={{$responseItem.description}}',
                            },
                        },
                        {
                            type: 'sort',
                            properties: {
                                key: 'name',
                            },
                        },
                    ],
                },
            },
        }, additionalData, chat_hub_constants_1.PROVIDER_NODE_TYPE_MAP.google, {}, credentials);
        return {
            models: results.map((result) => ({
                name: result.name,
                description: result.description ?? null,
                model: {
                    provider: 'google',
                    model: String(result.value),
                },
                createdAt: null,
                updatedAt: null,
                allowFileUploads: true,
            })),
        };
    }
    async fetchOllamaModels(credentials, additionalData) {
        const results = await this.nodeParametersService.getOptionsViaLoadOptions({
            routing: {
                request: {
                    method: 'GET',
                    url: '/api/tags',
                },
                output: {
                    postReceive: [
                        {
                            type: 'rootProperty',
                            properties: {
                                property: 'models',
                            },
                        },
                        {
                            type: 'setKeyValue',
                            properties: {
                                name: '={{$responseItem.name}}',
                                value: '={{$responseItem.name}}',
                            },
                        },
                        {
                            type: 'sort',
                            properties: {
                                key: 'name',
                            },
                        },
                    ],
                },
            },
        }, additionalData, chat_hub_constants_1.PROVIDER_NODE_TYPE_MAP.ollama, {}, credentials);
        return {
            models: results.map((result) => ({
                name: result.name,
                description: result.description ?? null,
                model: {
                    provider: 'ollama',
                    model: String(result.value),
                },
                createdAt: null,
                updatedAt: null,
                allowFileUploads: true,
            })),
        };
    }
    fetchAzureOpenAiModels(_credentials, _additionalData) {
        return {
            models: [],
        };
    }
    async fetchAwsBedrockModels(credentials, additionalData) {
        const foundationModelsRequest = this.nodeParametersService.getOptionsViaLoadOptions({
            routing: {
                request: {
                    method: 'GET',
                    url: '/foundation-models?&byOutputModality=TEXT&byInferenceType=ON_DEMAND',
                },
                output: {
                    postReceive: [
                        {
                            type: 'rootProperty',
                            properties: {
                                property: 'modelSummaries',
                            },
                        },
                        {
                            type: 'setKeyValue',
                            properties: {
                                name: '={{$responseItem.modelName}}',
                                description: '={{$responseItem.modelArn}}',
                                value: '={{$responseItem.modelId}}',
                            },
                        },
                        {
                            type: 'sort',
                            properties: {
                                key: 'name',
                            },
                        },
                    ],
                },
            },
        }, additionalData, chat_hub_constants_1.PROVIDER_NODE_TYPE_MAP.awsBedrock, {}, credentials);
        const inferenceProfileModelsRequest = this.nodeParametersService.getOptionsViaLoadOptions({
            routing: {
                request: {
                    method: 'GET',
                    url: '/inference-profiles?maxResults=1000',
                },
                output: {
                    postReceive: [
                        {
                            type: 'rootProperty',
                            properties: {
                                property: 'inferenceProfileSummaries',
                            },
                        },
                        {
                            type: 'setKeyValue',
                            properties: {
                                name: '={{$responseItem.inferenceProfileName}}',
                                description: '={{$responseItem.description || $responseItem.inferenceProfileArn}}',
                                value: '={{$responseItem.inferenceProfileId}}',
                            },
                        },
                        {
                            type: 'sort',
                            properties: {
                                key: 'name',
                            },
                        },
                    ],
                },
            },
        }, additionalData, chat_hub_constants_1.PROVIDER_NODE_TYPE_MAP.awsBedrock, {}, credentials);
        const [foundationModels, inferenceProfileModels] = await Promise.all([
            foundationModelsRequest,
            inferenceProfileModelsRequest,
        ]);
        return {
            models: foundationModels.concat(inferenceProfileModels).map((result) => ({
                name: result.name,
                description: result.description ?? String(result.value),
                model: {
                    provider: 'awsBedrock',
                    model: String(result.value),
                },
                createdAt: null,
                updatedAt: null,
                allowFileUploads: true,
            })),
        };
    }
    async fetchMistralCloudModels(credentials, additionalData) {
        const results = await this.nodeParametersService.getOptionsViaLoadOptions({
            routing: {
                request: {
                    method: 'GET',
                    url: '/models',
                },
                output: {
                    postReceive: [
                        {
                            type: 'rootProperty',
                            properties: {
                                property: 'data',
                            },
                        },
                        {
                            type: 'filter',
                            properties: {
                                pass: "={{ !$responseItem.id.includes('embed') }}",
                            },
                        },
                        {
                            type: 'setKeyValue',
                            properties: {
                                name: '={{ $responseItem.id }}',
                                value: '={{ $responseItem.id }}',
                            },
                        },
                        {
                            type: 'sort',
                            properties: {
                                key: 'name',
                            },
                        },
                    ],
                },
            },
        }, additionalData, chat_hub_constants_1.PROVIDER_NODE_TYPE_MAP.mistralCloud, {}, credentials);
        return {
            models: results.map((result) => ({
                name: result.name,
                description: result.description ?? String(result.value),
                model: {
                    provider: 'mistralCloud',
                    model: String(result.value),
                },
                createdAt: null,
                updatedAt: null,
            })),
        };
    }
    async fetchCohereModels(credentials, additionalData) {
        const results = await this.nodeParametersService.getOptionsViaLoadOptions({
            routing: {
                request: {
                    method: 'GET',
                    url: '/v1/models?page_size=100&endpoint=chat',
                },
                output: {
                    postReceive: [
                        {
                            type: 'rootProperty',
                            properties: {
                                property: 'models',
                            },
                        },
                        {
                            type: 'setKeyValue',
                            properties: {
                                name: '={{$responseItem.name}}',
                                value: '={{$responseItem.name}}',
                                description: '={{$responseItem.description}}',
                            },
                        },
                        {
                            type: 'sort',
                            properties: {
                                key: 'name',
                            },
                        },
                    ],
                },
            },
        }, additionalData, chat_hub_constants_1.PROVIDER_NODE_TYPE_MAP.cohere, {}, credentials);
        return {
            models: results.map((result) => ({
                name: result.name,
                description: result.description ?? null,
                model: {
                    provider: 'cohere',
                    model: String(result.value),
                },
                createdAt: null,
                updatedAt: null,
            })),
        };
    }
    async fetchDeepSeekModels(credentials, additionalData) {
        const results = await this.nodeParametersService.getOptionsViaLoadOptions({
            routing: {
                request: {
                    method: 'GET',
                    url: '/models',
                },
                output: {
                    postReceive: [
                        {
                            type: 'rootProperty',
                            properties: {
                                property: 'data',
                            },
                        },
                        {
                            type: 'setKeyValue',
                            properties: {
                                name: '={{$responseItem.id}}',
                                value: '={{$responseItem.id}}',
                            },
                        },
                        {
                            type: 'sort',
                            properties: {
                                key: 'name',
                            },
                        },
                    ],
                },
            },
        }, additionalData, chat_hub_constants_1.PROVIDER_NODE_TYPE_MAP.deepSeek, {}, credentials);
        return {
            models: results.map((result) => ({
                name: result.name,
                description: result.description ?? String(result.value),
                model: {
                    provider: 'deepSeek',
                    model: String(result.value),
                },
                createdAt: null,
                updatedAt: null,
            })),
        };
    }
    async fetchOpenRouterModels(credentials, additionalData) {
        const results = await this.nodeParametersService.getOptionsViaLoadOptions({
            routing: {
                request: {
                    method: 'GET',
                    url: '/models',
                },
                output: {
                    postReceive: [
                        {
                            type: 'rootProperty',
                            properties: {
                                property: 'data',
                            },
                        },
                        {
                            type: 'setKeyValue',
                            properties: {
                                name: '={{$responseItem.id}}',
                                value: '={{$responseItem.id}}',
                            },
                        },
                        {
                            type: 'sort',
                            properties: {
                                key: 'name',
                            },
                        },
                    ],
                },
            },
        }, additionalData, chat_hub_constants_1.PROVIDER_NODE_TYPE_MAP.openRouter, {}, credentials);
        return {
            models: results.map((result) => ({
                name: result.name,
                description: result.description ?? null,
                model: {
                    provider: 'openRouter',
                    model: String(result.value),
                },
                createdAt: null,
                updatedAt: null,
            })),
        };
    }
    async fetchGroqModels(credentials, additionalData) {
        const results = await this.nodeParametersService.getOptionsViaLoadOptions({
            routing: {
                request: {
                    method: 'GET',
                    url: '/models',
                },
                output: {
                    postReceive: [
                        {
                            type: 'rootProperty',
                            properties: {
                                property: 'data',
                            },
                        },
                        {
                            type: 'filter',
                            properties: {
                                pass: '={{ $responseItem.active === true && $responseItem.object === "model" }}',
                            },
                        },
                        {
                            type: 'setKeyValue',
                            properties: {
                                name: '={{$responseItem.id}}',
                                value: '={{$responseItem.id}}',
                            },
                        },
                    ],
                },
            },
        }, additionalData, chat_hub_constants_1.PROVIDER_NODE_TYPE_MAP.groq, {}, credentials);
        return {
            models: results.map((result) => ({
                name: result.name,
                description: result.description ?? null,
                model: {
                    provider: 'groq',
                    model: String(result.value),
                },
                createdAt: null,
                updatedAt: null,
            })),
        };
    }
    async fetchXAiGrokModels(credentials, additionalData) {
        const results = await this.nodeParametersService.getOptionsViaLoadOptions({
            routing: {
                request: {
                    method: 'GET',
                    url: '/models',
                },
                output: {
                    postReceive: [
                        {
                            type: 'rootProperty',
                            properties: {
                                property: 'data',
                            },
                        },
                        {
                            type: 'setKeyValue',
                            properties: {
                                name: '={{$responseItem.id}}',
                                value: '={{$responseItem.id}}',
                            },
                        },
                        {
                            type: 'sort',
                            properties: {
                                key: 'name',
                            },
                        },
                    ],
                },
            },
        }, additionalData, chat_hub_constants_1.PROVIDER_NODE_TYPE_MAP.xAiGrok, {}, credentials);
        return {
            models: results.map((result) => ({
                name: result.name,
                description: result.description ?? null,
                model: {
                    provider: 'xAiGrok',
                    model: String(result.value),
                },
                createdAt: null,
                updatedAt: null,
            })),
        };
    }
    async fetchVercelAiGatewayModels(credentials, additionalData) {
        const results = await this.nodeParametersService.getOptionsViaLoadOptions({
            routing: {
                request: {
                    method: 'GET',
                    url: '/models',
                },
                output: {
                    postReceive: [
                        {
                            type: 'rootProperty',
                            properties: {
                                property: 'data',
                            },
                        },
                        {
                            type: 'setKeyValue',
                            properties: {
                                name: '={{$responseItem.id}}',
                                value: '={{$responseItem.id}}',
                            },
                        },
                        {
                            type: 'sort',
                            properties: {
                                key: 'name',
                            },
                        },
                    ],
                },
            },
        }, additionalData, chat_hub_constants_1.PROVIDER_NODE_TYPE_MAP.vercelAiGateway, {}, credentials);
        return {
            models: results.map((result) => ({
                name: result.name,
                description: result.description ?? String(result.value),
                model: {
                    provider: 'vercelAiGateway',
                    model: String(result.value),
                },
                createdAt: null,
                updatedAt: null,
            })),
        };
    }
    async fetchAgentWorkflowsAsModels(user) {
        const nodeTypes = [n8n_workflow_1.CHAT_TRIGGER_NODE_TYPE];
        const workflows = await this.workflowService.getWorkflowsWithNodesIncluded(user, nodeTypes, true);
        return {
            models: workflows
                .filter((workflow) => workflow.scopes.includes('workflow:read'))
                .filter((workflow) => !!workflow.activeVersionId)
                .flatMap((workflow) => {
                const chatTrigger = workflow.nodes?.find((node) => node.type === n8n_workflow_1.CHAT_TRIGGER_NODE_TYPE);
                if (!chatTrigger) {
                    return [];
                }
                const chatTriggerParams = chat_hub_types_1.validChatTriggerParamsShape.safeParse(chatTrigger.parameters).data;
                if (!chatTriggerParams) {
                    return [];
                }
                return [
                    {
                        name: chatTriggerParams.agentName ?? workflow.name ?? 'Unknown Agent',
                        description: chatTriggerParams.agentDescription ?? null,
                        model: {
                            provider: 'n8n',
                            workflowId: workflow.id,
                        },
                        createdAt: workflow.createdAt ? workflow.createdAt.toISOString() : null,
                        updatedAt: workflow.updatedAt ? workflow.updatedAt.toISOString() : null,
                        allowFileUploads: chatTriggerParams.options?.allowFileUploads ?? false,
                    },
                ];
            }),
        };
    }
    async deleteChatWorkflow(workflowId) {
        await this.workflowRepository.delete(workflowId);
    }
    getErrorMessage(execution) {
        if (execution.data.resultData.error) {
            return execution.data.resultData.error.description ?? execution.data.resultData.error.message;
        }
        return undefined;
    }
    getAIOutput(execution, nodeName) {
        const agent = execution.data.resultData.runData[nodeName];
        if (!agent || !Array.isArray(agent) || agent.length === 0)
            return undefined;
        const runIndex = agent.length - 1;
        const mainOutputs = agent[runIndex].data?.main;
        if (mainOutputs && Array.isArray(mainOutputs)) {
            for (const branch of mainOutputs) {
                if (branch && Array.isArray(branch) && branch.length > 0 && branch[0].json?.output) {
                    if (typeof branch[0].json.output === 'string') {
                        return branch[0].json.output;
                    }
                }
            }
        }
        return undefined;
    }
    pickCredentialId(provider, credentials) {
        if (provider === 'n8n' || provider === 'custom-agent') {
            return null;
        }
        return credentials[api_types_1.PROVIDER_CREDENTIAL_TYPE_MAP[provider]]?.id ?? null;
    }
    async sendHumanMessage(res, user, payload) {
        const { sessionId, messageId, message, model, credentials, previousMessageId, tools, attachments, } = payload;
        const credentialId = this.getModelCredential(model, credentials);
        const processedAttachments = await this.chatHubAttachmentService.store(sessionId, messageId, attachments);
        let executionData;
        let workflowData;
        try {
            const result = await this.messageRepository.manager.transaction(async (trx) => {
                let session = await this.getChatSession(user, sessionId, trx);
                session ??= await this.createChatSession(user, sessionId, model, credentialId, tools, payload.agentName, trx);
                await this.ensurePreviousMessage(previousMessageId, sessionId, trx);
                const messages = Object.fromEntries((session.messages ?? []).map((m) => [m.id, m]));
                const history = this.buildMessageHistory(messages, previousMessageId);
                await this.saveHumanMessage(payload, processedAttachments, user, previousMessageId, model, undefined, trx);
                return await this.prepareReplyWorkflow(user, sessionId, credentials, model, history, message, tools, processedAttachments, trx);
            });
            executionData = result.executionData;
            workflowData = result.workflowData;
        }
        catch (error) {
            if (processedAttachments.length > 0) {
                try {
                    await this.chatHubAttachmentService.deleteAttachments(processedAttachments);
                }
                catch (error) {
                    this.errorReporter.warn(`Could not clean up ${processedAttachments.length} files`);
                }
            }
            throw error;
        }
        await this.executeChatWorkflowWithCleanup(res, user, workflowData, executionData, sessionId, messageId, model);
        if (previousMessageId === null) {
            await this.generateSessionTitle(user, sessionId, message, credentials, model).catch((error) => {
                this.logger.error(`Title generation failed: ${error}`);
            });
        }
    }
    async editMessage(res, user, payload) {
        const { sessionId, editId, messageId, message, model, credentials } = payload;
        const workflow = await this.messageRepository.manager.transaction(async (trx) => {
            const session = await this.getChatSession(user, sessionId, trx);
            if (!session) {
                throw new not_found_error_1.NotFoundError('Chat session not found');
            }
            const messageToEdit = await this.getChatMessage(session.id, editId, [], trx);
            if (messageToEdit.type === 'ai') {
                await this.messageRepository.updateChatMessage(editId, { content: payload.message }, trx);
                return null;
            }
            if (messageToEdit.type === 'human') {
                const messages = Object.fromEntries((session.messages ?? []).map((m) => [m.id, m]));
                const history = this.buildMessageHistory(messages, messageToEdit.previousMessageId);
                const revisionOfMessageId = messageToEdit.revisionOfMessageId ?? messageToEdit.id;
                const attachments = messageToEdit.attachments ?? [];
                await this.saveHumanMessage(payload, attachments, user, messageToEdit.previousMessageId, model, revisionOfMessageId, trx);
                return await this.prepareReplyWorkflow(user, sessionId, credentials, model, history, message, session.tools, attachments, trx);
            }
            throw new bad_request_error_1.BadRequestError('Only human and AI messages can be edited');
        });
        if (!workflow) {
            return;
        }
        const { workflowData, executionData } = workflow;
        await this.executeChatWorkflowWithCleanup(res, user, workflowData, executionData, sessionId, messageId, model);
    }
    async regenerateAIMessage(res, user, payload) {
        const { sessionId, retryId, model, credentials } = payload;
        const { workflow: { workflowData, executionData }, retryOfMessageId, previousMessageId, } = await this.messageRepository.manager.transaction(async (trx) => {
            const session = await this.getChatSession(user, sessionId, trx);
            if (!session) {
                throw new not_found_error_1.NotFoundError('Chat session not found');
            }
            const messageToRetry = await this.getChatMessage(session.id, retryId, [], trx);
            if (messageToRetry.type !== 'ai') {
                throw new bad_request_error_1.BadRequestError('Can only retry AI messages');
            }
            const messages = Object.fromEntries((session.messages ?? []).map((m) => [m.id, m]));
            const history = this.buildMessageHistory(messages, messageToRetry.previousMessageId);
            const lastHumanMessage = history.filter((m) => m.type === 'human').pop();
            if (!lastHumanMessage) {
                throw new bad_request_error_1.BadRequestError('No human message found to base the retry on');
            }
            const lastHumanMessageIndex = history.indexOf(lastHumanMessage);
            if (lastHumanMessageIndex !== -1) {
                history.splice(lastHumanMessageIndex + 1);
            }
            const retryOfMessageId = messageToRetry.retryOfMessageId ?? messageToRetry.id;
            const message = lastHumanMessage ? lastHumanMessage.content : '';
            const attachments = lastHumanMessage.attachments ?? [];
            const workflow = await this.prepareReplyWorkflow(user, sessionId, credentials, model, history, message, session.tools, attachments, trx);
            return {
                workflow,
                previousMessageId: lastHumanMessage.id,
                retryOfMessageId,
            };
        });
        await this.executeChatWorkflowWithCleanup(res, user, workflowData, executionData, sessionId, previousMessageId, model, retryOfMessageId);
    }
    async prepareReplyWorkflow(user, sessionId, credentials, model, history, message, tools, attachments, trx) {
        if (model.provider === 'n8n') {
            return await this.prepareCustomAgentWorkflow(user, sessionId, model.workflowId, message, attachments);
        }
        if (model.provider === 'custom-agent') {
            return await this.prepareChatAgentWorkflow(model.agentId, user, sessionId, history, message, attachments, trx);
        }
        return await this.prepareBaseChatWorkflow(user, sessionId, credentials, model, history, message, undefined, tools, attachments, trx);
    }
    async prepareBaseChatWorkflow(user, sessionId, credentials, model, history, message, systemMessage, tools, attachments, trx) {
        await this.chatHubSettingsService.ensureModelIsAllowed(model);
        const credential = await this.chatHubCredentialsService.ensureCredentials(user, model.provider, credentials, trx);
        return await this.chatHubWorkflowService.createChatWorkflow(user.id, sessionId, credential.projectId, history, message, attachments, credentials, model, systemMessage, tools, trx);
    }
    async prepareChatAgentWorkflow(agentId, user, sessionId, history, message, attachments, trx) {
        const agent = await this.chatHubAgentService.getAgentById(agentId, user.id);
        if (!agent) {
            throw new bad_request_error_1.BadRequestError('Agent not found');
        }
        if (!agent.provider || !agent.model) {
            throw new bad_request_error_1.BadRequestError('Provider or model not set for agent');
        }
        if (agent.provider === 'n8n' || agent.provider === 'custom-agent') {
            throw new bad_request_error_1.BadRequestError('Invalid provider');
        }
        const credentialId = agent.credentialId;
        if (!credentialId) {
            throw new bad_request_error_1.BadRequestError('Credentials not set for agent');
        }
        const systemMessage = agent.systemPrompt;
        const model = {
            provider: agent.provider,
            model: agent.model,
        };
        const credentials = {
            [api_types_1.PROVIDER_CREDENTIAL_TYPE_MAP[agent.provider]]: {
                id: credentialId,
                name: '',
            },
        };
        const tools = [];
        return await this.prepareBaseChatWorkflow(user, sessionId, credentials, model, history, message, systemMessage, tools, attachments, trx);
    }
    async prepareCustomAgentWorkflow(user, sessionId, workflowId, message, attachments) {
        const workflowEntity = await this.workflowFinderService.findWorkflowForUser(workflowId, user, ['workflow:read'], { includeTags: false, includeParentFolder: false });
        if (!workflowEntity) {
            throw new bad_request_error_1.BadRequestError('Workflow not found');
        }
        const chatTriggers = workflowEntity.nodes.filter((node) => node.type === n8n_workflow_1.CHAT_TRIGGER_NODE_TYPE);
        if (chatTriggers.length !== 1) {
            throw new bad_request_error_1.BadRequestError('Workflow must have exactly one chat trigger');
        }
        const chatTriggerNode = chatTriggers[0];
        const chatResponseNodes = workflowEntity.nodes.filter((node) => node.type === n8n_workflow_1.RESPOND_TO_CHAT_NODE_TYPE);
        if (chatResponseNodes.length > 0) {
            throw new bad_request_error_1.BadRequestError('Respond to Chat nodes are not supported in custom agent workflows');
        }
        const nodeExecutionStack = this.chatHubWorkflowService.prepareExecutionData(chatTriggerNode, sessionId, message, attachments);
        const executionData = (0, n8n_workflow_1.createRunExecutionData)({
            executionData: {
                nodeExecutionStack,
            },
            manualData: {
                userId: user.id,
            },
        });
        return {
            workflowData: {
                ...workflowEntity,
            },
            executionData,
        };
    }
    async ensurePreviousMessage(previousMessageId, sessionId, trx) {
        if (!previousMessageId) {
            return;
        }
        const previousMessage = await this.messageRepository.getOneById(previousMessageId, sessionId, [], trx);
        if (!previousMessage) {
            throw new bad_request_error_1.BadRequestError('The previous message does not exist in the session');
        }
    }
    async stopGeneration(user, sessionId, messageId) {
        const session = await this.getChatSession(user, sessionId);
        if (!session) {
            throw new not_found_error_1.NotFoundError('Chat session not found');
        }
        const message = await this.getChatMessage(session.id, messageId, [
            'execution',
            'execution.workflow',
        ]);
        if (message.type !== 'ai') {
            throw new bad_request_error_1.BadRequestError('Can only stop AI messages');
        }
        if (!message.executionId || !message.execution) {
            throw new bad_request_error_1.BadRequestError('Message is not associated with a workflow execution');
        }
        if (message.status !== 'running') {
            throw new bad_request_error_1.BadRequestError('Can only stop messages that are currently running');
        }
        await this.executionService.stop(message.execution.id, [message.execution.workflowId]);
        await this.messageRepository.updateChatMessage(messageId, { status: 'cancelled' });
    }
    async executeChatWorkflow(res, user, workflowData, executionData, sessionId, previousMessageId, model, retryOfMessageId = null, executionMode = 'chat') {
        this.logger.debug(`Starting execution of workflow "${workflowData.name}" with ID ${workflowData.id}`);
        let executionId = undefined;
        const aggregator = (0, stream_capturer_1.createStructuredChunkAggregator)(previousMessageId, retryOfMessageId, {
            onBegin: async (message) => {
                await this.saveAIMessage({
                    ...message,
                    sessionId,
                    executionId,
                    model,
                    retryOfMessageId,
                });
            },
            onItem: (_message, _chunk) => {
            },
            onEnd: async (message) => {
                await this.messageRepository.updateChatMessage(message.id, {
                    content: message.content,
                    status: message.status,
                });
            },
            onError: async (message, _errorText) => {
                await this.messageRepository.manager.transaction(async (trx) => {
                    await this.messageRepository.updateChatMessage(message.id, {
                        content: message.content,
                    }, trx);
                    const savedMessage = await this.messageRepository.getOneById(message.id, sessionId, [], trx);
                    if (savedMessage?.status === 'cancelled') {
                        return;
                    }
                    await this.messageRepository.updateChatMessage(message.id, {
                        status: 'error',
                    }, trx);
                });
            },
        });
        const transform = (text) => {
            const trimmed = text.trim();
            if (!trimmed)
                return text;
            let chunk = null;
            try {
                chunk = (0, n8n_workflow_1.jsonParse)(trimmed);
            }
            catch {
                return text;
            }
            const message = aggregator.ingest(chunk);
            const enriched = {
                ...chunk,
                metadata: {
                    ...chunk.metadata,
                    messageId: message.id,
                    previousMessageId: message.previousMessageId,
                    retryOfMessageId: message.retryOfMessageId,
                    executionId: executionId ? +executionId : null,
                },
            };
            return JSON.stringify(enriched) + '\n';
        };
        const stream = (0, stream_capturer_1.interceptResponseWrites)(res, transform);
        stream.on('finish', aggregator.finalizeAll);
        stream.on('close', aggregator.finalizeAll);
        stream.writeHead(200, chat_hub_constants_1.JSONL_STREAM_HEADERS);
        stream.flushHeaders();
        const execution = await this.workflowExecutionService.executeChatWorkflow(workflowData, executionData, user, stream, true, executionMode);
        executionId = execution.executionId;
        if (!executionId) {
            throw new n8n_workflow_1.OperationalError('There was a problem starting the chat execution.');
        }
        try {
            const result = await this.activeExecutions.getPostExecutePromise(executionId);
            if (!result) {
                throw new n8n_workflow_1.OperationalError('There was a problem executing the chat workflow.');
            }
        }
        catch (error) {
            if (error instanceof n8n_workflow_1.ManualExecutionCancelledError) {
                return;
            }
            if (error instanceof Error) {
                this.logger.error(`Error during chat workflow execution: ${error}`);
            }
            throw error;
        }
    }
    async executeChatWorkflowWithCleanup(res, user, workflowData, executionData, sessionId, previousMessageId, model, retryOfMessageId = null) {
        try {
            const executionMode = model.provider === 'n8n' ? 'webhook' : 'chat';
            await this.executeChatWorkflow(res, user, workflowData, executionData, sessionId, previousMessageId, model, retryOfMessageId, executionMode);
        }
        finally {
            if (model.provider !== 'n8n') {
                await this.deleteChatWorkflow(workflowData.id);
            }
        }
    }
    async generateSessionTitle(user, sessionId, humanMessage, credentials, model) {
        const { executionData, workflowData } = await this.prepareTitleGenerationWorkflow(user, sessionId, humanMessage, credentials, model);
        try {
            const title = await this.runTitleWorkflowAndGetTitle(user, workflowData, executionData);
            if (title) {
                await this.sessionRepository.updateChatTitle(sessionId, title);
            }
        }
        catch (error) {
            if (error instanceof Error) {
                this.logger.error(`Error during session title generation workflow execution: ${error}`);
            }
            throw error;
        }
        finally {
            await this.deleteChatWorkflow(workflowData.id);
        }
    }
    async prepareTitleGenerationWorkflow(user, sessionId, humanMessage, incomingCredentials, incomingModel) {
        return await this.messageRepository.manager.transaction(async (trx) => {
            const { resolvedCredentials, resolvedModel, credential } = await this.resolveCredentialsAndModelForTitle(user, incomingModel, incomingCredentials, trx);
            if (!credential) {
                throw new bad_request_error_1.BadRequestError('Could not determine credentials for title generation');
            }
            this.logger.debug(`Using credential ID ${credential.id} for title generation in project ${credential.projectId}, model ${JSON.stringify(resolvedModel)}`);
            return await this.chatHubWorkflowService.createTitleGenerationWorkflow(user.id, sessionId, credential.projectId, humanMessage, resolvedCredentials, resolvedModel, trx);
        });
    }
    async resolveCredentialsAndModelForTitle(user, model, credentials, trx) {
        if (model.provider === 'n8n') {
            return await this.resolveFromN8nWorkflow(user, model, trx);
        }
        if (model.provider === 'custom-agent') {
            return await this.resolveFromCustomAgent(user, model, trx);
        }
        const credential = await this.chatHubCredentialsService.ensureCredentials(user, model.provider, credentials, trx);
        return {
            resolvedCredentials: credentials,
            resolvedModel: model,
            credential,
        };
    }
    async resolveFromN8nWorkflow(user, { workflowId }, trx) {
        const workflowEntity = await this.workflowFinderService.findWorkflowForUser(workflowId, user, ['workflow:read'], { includeTags: false, includeParentFolder: false, em: trx });
        if (!workflowEntity) {
            throw new bad_request_error_1.BadRequestError('Workflow not found for title generation');
        }
        const modelNodes = this.findSupportedLLMNodes(workflowEntity);
        this.logger.debug(`Found ${modelNodes.length} LLM nodes in workflow ${workflowEntity.id} for title generation`);
        if (modelNodes.length === 0) {
            throw new bad_request_error_1.BadRequestError('No supported Model nodes found in workflow for title generation');
        }
        const modelNode = modelNodes[0];
        const llmModel = modelNode.node.parameters?.model?.value;
        if (!llmModel) {
            throw new bad_request_error_1.BadRequestError(`No model set on Model node "${modelNode.node.name}" for title generation`);
        }
        if (typeof llmModel !== 'string' || llmModel.length === 0 || llmModel.startsWith('=')) {
            throw new bad_request_error_1.BadRequestError(`Invalid model set on Model node "${modelNode.node.name}" for title generation`);
        }
        const llmCredentials = modelNode.node.credentials;
        if (!llmCredentials) {
            throw new bad_request_error_1.BadRequestError(`No credentials found on Model node "${modelNode.node.name}" for title generation`);
        }
        const credential = await this.chatHubCredentialsService.ensureWorkflowCredentials(modelNode.provider, llmCredentials, workflowId);
        const resolvedModel = {
            provider: modelNode.provider,
            model: llmModel,
        };
        const resolvedCredentials = {
            [api_types_1.PROVIDER_CREDENTIAL_TYPE_MAP[modelNode.provider]]: {
                id: credential.id,
                name: '',
            },
        };
        return { resolvedCredentials, resolvedModel, credential };
    }
    findSupportedLLMNodes(workflowEntity) {
        return workflowEntity.nodes.reduce((acc, node) => {
            const supportedProvider = Object.entries(chat_hub_constants_1.PROVIDER_NODE_TYPE_MAP).find(([_provider, { name }]) => node.type === name);
            if (supportedProvider) {
                const [provider] = supportedProvider;
                acc.push({ node, provider: provider });
            }
            return acc;
        }, []);
    }
    async resolveFromCustomAgent(user, model, trx) {
        const agent = await this.chatHubAgentService.getAgentById(model.agentId, user.id);
        if (!agent) {
            throw new bad_request_error_1.BadRequestError('Agent not found for title generation');
        }
        if (agent.provider === 'n8n' || agent.provider === 'custom-agent') {
            throw new bad_request_error_1.BadRequestError('Invalid provider for title generation');
        }
        const credentialId = agent.credentialId;
        if (!credentialId) {
            throw new bad_request_error_1.BadRequestError('Credentials not set for agent');
        }
        const resolvedModel = {
            provider: agent.provider,
            model: agent.model,
        };
        const resolvedCredentials = {
            [api_types_1.PROVIDER_CREDENTIAL_TYPE_MAP[agent.provider]]: {
                id: credentialId,
                name: '',
            },
        };
        const credential = await this.chatHubCredentialsService.ensureCredentials(user, agent.provider, resolvedCredentials, trx);
        return { resolvedCredentials, resolvedModel, credential };
    }
    async runTitleWorkflowAndGetTitle(user, workflowData, executionData) {
        const started = await this.workflowExecutionService.executeChatWorkflow(workflowData, executionData, user, undefined, false, 'chat');
        const executionId = started.executionId;
        if (!executionId) {
            throw new n8n_workflow_1.OperationalError('There was a problem starting the chat execution.');
        }
        let run;
        try {
            run = await this.activeExecutions.getPostExecutePromise(executionId);
            if (!run) {
                throw new n8n_workflow_1.OperationalError('There was a problem executing the chat workflow.');
            }
        }
        catch (error) {
            if (error instanceof n8n_workflow_1.ManualExecutionCancelledError) {
                return null;
            }
            throw error;
        }
        const execution = await this.executionRepository.findWithUnflattenedData(executionId, [
            workflowData.id,
        ]);
        if (!execution) {
            throw new n8n_workflow_1.OperationalError(`Could not find execution with ID ${executionId}`);
        }
        if (!execution.status || execution.status !== 'success') {
            const message = this.getErrorMessage(execution) ?? 'Failed to generate a response';
            throw new n8n_workflow_1.OperationalError(message);
        }
        const title = this.getAIOutput(execution, chat_hub_constants_1.NODE_NAMES.TITLE_GENERATOR_AGENT);
        return title ?? null;
    }
    async saveHumanMessage(payload, attachments, user, previousMessageId, model, revisionOfMessageId, trx) {
        await this.messageRepository.createChatMessage({
            id: payload.messageId,
            sessionId: payload.sessionId,
            type: 'human',
            status: 'success',
            content: payload.message,
            previousMessageId,
            revisionOfMessageId,
            name: user.firstName || 'User',
            attachments,
            ...model,
        }, trx);
    }
    async saveAIMessage({ id, sessionId, executionId, previousMessageId, content, model, retryOfMessageId, status, }) {
        await this.messageRepository.createChatMessage({
            id,
            sessionId,
            previousMessageId,
            executionId: executionId ? parseInt(executionId, 10) : null,
            type: 'ai',
            name: 'AI',
            status,
            content,
            retryOfMessageId,
            ...model,
        });
    }
    getModelCredential(model, credentials) {
        const credentialId = model.provider !== 'n8n' ? this.pickCredentialId(model.provider, credentials) : null;
        return credentialId;
    }
    async getChatSession(user, sessionId, trx) {
        return await this.sessionRepository.getOneById(sessionId, user.id, trx);
    }
    async createChatSession(user, sessionId, model, credentialId, tools, agentName, trx) {
        await this.ensureValidModel(user, model);
        return await this.sessionRepository.createChatSession({
            id: sessionId,
            ownerId: user.id,
            title: 'New Chat',
            agentName,
            tools,
            credentialId,
            ...model,
        }, trx);
    }
    async getChatMessage(sessionId, messageId, relations = [], trx) {
        const message = await this.messageRepository.getOneById(messageId, sessionId, relations, trx);
        if (!message) {
            throw new not_found_error_1.NotFoundError('Chat message not found');
        }
        return message;
    }
    async getConversations(userId, limit, cursor) {
        const sessions = await this.sessionRepository.getManyByUserId(userId, limit + 1, cursor);
        const hasMore = sessions.length > limit;
        const data = hasMore ? sessions.slice(0, limit) : sessions;
        const nextCursor = hasMore ? data[data.length - 1].id : null;
        return {
            data: data.map((session) => ({
                id: session.id,
                title: session.title,
                ownerId: session.ownerId,
                lastMessageAt: session.lastMessageAt?.toISOString() ?? null,
                credentialId: session.credentialId,
                provider: session.provider,
                model: session.model,
                workflowId: session.workflowId,
                agentId: session.agentId,
                agentName: session.agentName ?? '',
                createdAt: session.createdAt.toISOString(),
                updatedAt: session.updatedAt.toISOString(),
                tools: session.tools,
            })),
            nextCursor,
            hasMore,
        };
    }
    async getConversation(userId, sessionId) {
        const session = await this.sessionRepository.getOneById(sessionId, userId);
        if (!session) {
            throw new not_found_error_1.NotFoundError('Chat session not found');
        }
        const messages = await this.messageRepository.getManyBySessionId(sessionId);
        return {
            session: {
                id: session.id,
                title: session.title,
                ownerId: session.ownerId,
                lastMessageAt: session.lastMessageAt?.toISOString() ?? null,
                credentialId: session.credentialId,
                provider: session.provider,
                model: session.model,
                workflowId: session.workflowId,
                agentId: session.agentId,
                agentName: session.agentName ?? '',
                createdAt: session.createdAt.toISOString(),
                updatedAt: session.updatedAt.toISOString(),
                tools: session.tools,
            },
            conversation: {
                messages: Object.fromEntries(messages.map((m) => [m.id, this.convertMessageToDto(m)])),
            },
        };
    }
    convertMessageToDto(message) {
        return {
            id: message.id,
            sessionId: message.sessionId,
            type: message.type,
            name: message.name,
            content: message.content,
            provider: message.provider,
            model: message.model,
            workflowId: message.workflowId,
            agentId: message.agentId,
            executionId: message.executionId,
            status: message.status,
            createdAt: message.createdAt.toISOString(),
            updatedAt: message.updatedAt.toISOString(),
            previousMessageId: message.previousMessageId,
            retryOfMessageId: message.retryOfMessageId,
            revisionOfMessageId: message.revisionOfMessageId,
            attachments: (message.attachments ?? []).map(({ fileName, mimeType }) => ({
                fileName,
                mimeType,
            })),
        };
    }
    buildMessageHistory(messages, lastMessageId) {
        if (!lastMessageId)
            return [];
        const visited = new Set();
        const historyIds = [];
        let current = lastMessageId;
        while (current && !visited.has(current)) {
            historyIds.unshift(current);
            visited.add(current);
            current = messages[current]?.previousMessageId ?? null;
        }
        const history = historyIds.flatMap((id) => messages[id] ?? []);
        return history;
    }
    async deleteAllSessions() {
        await this.chatHubAttachmentService.deleteAll();
        const result = await this.sessionRepository.deleteAll();
        return result;
    }
    async updateSessionTitle(userId, sessionId, title) {
        const session = await this.sessionRepository.getOneById(sessionId, userId);
        if (!session) {
            throw new not_found_error_1.NotFoundError('Session not found');
        }
        return await this.sessionRepository.updateChatTitle(sessionId, title);
    }
    async updateSession(user, sessionId, updates) {
        const session = await this.sessionRepository.getOneById(sessionId, user.id);
        if (!session) {
            throw new not_found_error_1.NotFoundError('Session not found');
        }
        const sessionUpdates = {};
        if (updates.agent) {
            const model = updates.agent.model;
            await this.ensureValidModel(user, model);
            sessionUpdates.agentName = updates.agent.name;
            sessionUpdates.provider = model.provider;
            sessionUpdates.model = null;
            sessionUpdates.credentialId = null;
            sessionUpdates.agentId = null;
            sessionUpdates.workflowId = null;
            if (updates.agent.model.provider === 'n8n') {
                sessionUpdates.workflowId = updates.agent.model.workflowId;
            }
            else if (updates.agent.model.provider === 'custom-agent') {
                sessionUpdates.agentId = updates.agent.model.agentId;
            }
            else {
                sessionUpdates.model = updates.agent.model.model;
            }
        }
        if (updates.title !== undefined)
            sessionUpdates.title = updates.title;
        if (updates.credentialId !== undefined)
            sessionUpdates.credentialId = updates.credentialId;
        return await this.sessionRepository.updateChatSession(sessionId, sessionUpdates);
    }
    async deleteSession(userId, sessionId) {
        const session = await this.sessionRepository.getOneById(sessionId, userId);
        if (!session) {
            throw new not_found_error_1.NotFoundError('Session not found');
        }
        await this.chatHubAttachmentService.deleteAllBySessionId(sessionId);
        await this.sessionRepository.deleteChatHubSession(sessionId);
    }
    async ensureValidModel(user, model) {
        if (model.provider === 'custom-agent') {
            const agent = await this.chatHubAgentService.getAgentById(model.agentId, user.id);
            if (!agent) {
                throw new bad_request_error_1.BadRequestError('Agent not found for chat session initialization');
            }
        }
        if (model.provider === 'n8n') {
            const workflow = await this.workflowFinderService.findWorkflowForUser(model.workflowId, user, ['workflow:read'], { includeTags: false, includeParentFolder: false });
            if (!workflow) {
                throw new bad_request_error_1.BadRequestError('Workflow not found for chat session initialization');
            }
            const chatTrigger = workflow.nodes?.find((node) => node.type === n8n_workflow_1.CHAT_TRIGGER_NODE_TYPE);
            if (!chatTrigger) {
                throw new bad_request_error_1.BadRequestError('Chat trigger not found in workflow for chat session initialization');
            }
        }
    }
};
exports.ChatHubService = ChatHubService;
exports.ChatHubService = ChatHubService = __decorate([
    (0, di_1.Service)(),
    __metadata("design:paramtypes", [backend_common_1.Logger,
        n8n_core_1.ErrorReporter,
        execution_service_1.ExecutionService,
        dynamic_node_parameters_service_1.DynamicNodeParametersService,
        db_1.ExecutionRepository,
        workflow_execution_service_1.WorkflowExecutionService,
        workflow_service_1.WorkflowService,
        workflow_finder_service_1.WorkflowFinderService,
        db_1.WorkflowRepository,
        active_executions_1.ActiveExecutions,
        chat_session_repository_1.ChatHubSessionRepository,
        chat_message_repository_1.ChatHubMessageRepository,
        credentials_finder_service_1.CredentialsFinderService,
        chat_hub_agent_service_1.ChatHubAgentService,
        chat_hub_credentials_service_1.ChatHubCredentialsService,
        chat_hub_workflow_service_1.ChatHubWorkflowService,
        chat_hub_settings_service_1.ChatHubSettingsService,
        chat_hub_attachment_service_1.ChatHubAttachmentService])
], ChatHubService);
//# sourceMappingURL=chat-hub.service.js.map