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
exports.ChatHubWorkflowService = void 0;
const backend_common_1 = require("@n8n/backend-common");
const db_1 = require("@n8n/db");
const di_1 = require("@n8n/di");
const n8n_workflow_1 = require("n8n-workflow");
const uuid_1 = require("uuid");
const chat_hub_constants_1 = require("./chat-hub.constants");
const context_limits_1 = require("./context-limits");
let ChatHubWorkflowService = class ChatHubWorkflowService {
    constructor(logger, workflowRepository, sharedWorkflowRepository) {
        this.logger = logger;
        this.workflowRepository = workflowRepository;
        this.sharedWorkflowRepository = sharedWorkflowRepository;
    }
    async createChatWorkflow(userId, sessionId, projectId, history, humanMessage, attachments, credentials, model, systemMessage, tools, trx) {
        return await (0, db_1.withTransaction)(this.workflowRepository.manager, trx, async (em) => {
            this.logger.debug(`Creating chat workflow for user ${userId} and session ${sessionId}, provider ${model.provider}`);
            const { nodes, connections, executionData } = this.buildChatWorkflow({
                userId,
                sessionId,
                history,
                humanMessage,
                attachments,
                credentials,
                model,
                systemMessage,
                tools,
            });
            const newWorkflow = new db_1.WorkflowEntity();
            newWorkflow.isArchived = true;
            newWorkflow.versionId = (0, uuid_1.v4)();
            newWorkflow.name = `Chat ${sessionId}`;
            newWorkflow.active = false;
            newWorkflow.activeVersionId = null;
            newWorkflow.nodes = nodes;
            newWorkflow.connections = connections;
            newWorkflow.settings = {
                executionOrder: 'v1',
            };
            const workflow = await em.save(newWorkflow);
            await em.save(this.sharedWorkflowRepository.create({
                role: 'workflow:owner',
                projectId,
                workflow,
            }));
            return {
                workflowData: workflow,
                executionData,
            };
        });
    }
    async createTitleGenerationWorkflow(userId, sessionId, projectId, humanMessage, credentials, model, trx) {
        return await (0, db_1.withTransaction)(this.workflowRepository.manager, trx, async (em) => {
            this.logger.debug(`Creating title generation workflow for user ${userId} and session ${sessionId}, provider ${model.provider}`);
            const { nodes, connections, executionData } = this.buildTitleGenerationWorkflow(userId, sessionId, credentials, model, humanMessage);
            const newWorkflow = new db_1.WorkflowEntity();
            newWorkflow.isArchived = true;
            newWorkflow.versionId = (0, uuid_1.v4)();
            newWorkflow.name = `Chat ${sessionId} (Title Generation)`;
            newWorkflow.active = false;
            newWorkflow.activeVersionId = null;
            newWorkflow.nodes = nodes;
            newWorkflow.connections = connections;
            newWorkflow.settings = {
                executionOrder: 'v1',
                saveDataSuccessExecution: 'all',
            };
            const workflow = await em.save(newWorkflow);
            await em.save(this.sharedWorkflowRepository.create({
                role: 'workflow:owner',
                projectId,
                workflow,
            }));
            return {
                workflowData: workflow,
                executionData,
            };
        });
    }
    prepareExecutionData(triggerNode, sessionId, message, attachments) {
        return [
            {
                node: triggerNode,
                data: {
                    main: [
                        [
                            {
                                json: {
                                    sessionId,
                                    action: 'sendMessage',
                                    chatInput: message,
                                    files: attachments.map(({ data, ...metadata }) => metadata),
                                },
                                binary: Object.fromEntries(attachments.map((attachment, index) => [`data${index}`, attachment])),
                            },
                        ],
                    ],
                },
                source: null,
            },
        ];
    }
    getUniqueNodeName(originalName, existingNames) {
        if (!existingNames.has(originalName)) {
            return originalName;
        }
        let index = 1;
        let uniqueName = `${originalName}${index}`;
        while (existingNames.has(uniqueName)) {
            index++;
            uniqueName = `${originalName}${index}`;
        }
        return uniqueName;
    }
    buildChatWorkflow({ userId, sessionId, history, humanMessage, attachments, credentials, model, systemMessage, tools, }) {
        const chatTriggerNode = this.buildChatTriggerNode();
        const toolsAgentNode = this.buildToolsAgentNode(model, systemMessage);
        const modelNode = this.buildModelNode(credentials, model);
        const memoryNode = this.buildMemoryNode(20);
        const restoreMemoryNode = this.buildRestoreMemoryNode(history);
        const clearMemoryNode = this.buildClearMemoryNode();
        const mergeNode = this.buildMergeNode();
        const nodes = [
            chatTriggerNode,
            toolsAgentNode,
            modelNode,
            memoryNode,
            restoreMemoryNode,
            clearMemoryNode,
            mergeNode,
        ];
        const nodeNames = new Set(nodes.map((node) => node.name));
        const distinctTools = tools.map((tool, i) => {
            const position = [
                700 + Math.floor(i / 3) * 60 + (i % 3) * 120,
                300 + Math.floor(i / 3) * 120 - (i % 3) * 30,
            ];
            const name = this.getUniqueNodeName(tool.name, nodeNames);
            nodeNames.add(name);
            return {
                ...tool,
                name,
                position,
            };
        });
        nodes.push.apply(nodes, distinctTools);
        const connections = {
            [chat_hub_constants_1.NODE_NAMES.CHAT_TRIGGER]: {
                [n8n_workflow_1.NodeConnectionTypes.Main]: [
                    [
                        { node: chat_hub_constants_1.NODE_NAMES.RESTORE_CHAT_MEMORY, type: n8n_workflow_1.NodeConnectionTypes.Main, index: 0 },
                        { node: chat_hub_constants_1.NODE_NAMES.MERGE, type: n8n_workflow_1.NodeConnectionTypes.Main, index: 0 },
                    ],
                ],
            },
            [chat_hub_constants_1.NODE_NAMES.RESTORE_CHAT_MEMORY]: {
                [n8n_workflow_1.NodeConnectionTypes.Main]: [
                    [{ node: chat_hub_constants_1.NODE_NAMES.MERGE, type: n8n_workflow_1.NodeConnectionTypes.Main, index: 1 }],
                ],
            },
            [chat_hub_constants_1.NODE_NAMES.MERGE]: {
                [n8n_workflow_1.NodeConnectionTypes.Main]: [
                    [{ node: chat_hub_constants_1.NODE_NAMES.REPLY_AGENT, type: n8n_workflow_1.NodeConnectionTypes.Main, index: 0 }],
                ],
            },
            [chat_hub_constants_1.NODE_NAMES.CHAT_MODEL]: {
                [n8n_workflow_1.NodeConnectionTypes.AiLanguageModel]: [
                    [{ node: chat_hub_constants_1.NODE_NAMES.REPLY_AGENT, type: n8n_workflow_1.NodeConnectionTypes.AiLanguageModel, index: 0 }],
                ],
            },
            [chat_hub_constants_1.NODE_NAMES.MEMORY]: {
                [n8n_workflow_1.NodeConnectionTypes.AiMemory]: [
                    [
                        { node: chat_hub_constants_1.NODE_NAMES.REPLY_AGENT, type: n8n_workflow_1.NodeConnectionTypes.AiMemory, index: 0 },
                        { node: chat_hub_constants_1.NODE_NAMES.RESTORE_CHAT_MEMORY, type: n8n_workflow_1.NodeConnectionTypes.AiMemory, index: 0 },
                        { node: chat_hub_constants_1.NODE_NAMES.CLEAR_CHAT_MEMORY, type: n8n_workflow_1.NodeConnectionTypes.AiMemory, index: 0 },
                    ],
                ],
            },
            [chat_hub_constants_1.NODE_NAMES.REPLY_AGENT]: {
                [n8n_workflow_1.NodeConnectionTypes.Main]: [
                    [
                        {
                            node: chat_hub_constants_1.NODE_NAMES.CLEAR_CHAT_MEMORY,
                            type: n8n_workflow_1.NodeConnectionTypes.Main,
                            index: 0,
                        },
                    ],
                ],
            },
            ...distinctTools.reduce((acc, tool) => {
                acc[tool.name] = {
                    [n8n_workflow_1.NodeConnectionTypes.AiTool]: [
                        [
                            {
                                node: chat_hub_constants_1.NODE_NAMES.REPLY_AGENT,
                                type: n8n_workflow_1.NodeConnectionTypes.AiTool,
                                index: 0,
                            },
                        ],
                    ],
                };
                return acc;
            }, {}),
        };
        const nodeExecutionStack = this.prepareExecutionData(chatTriggerNode, sessionId, humanMessage, attachments);
        const executionData = (0, n8n_workflow_1.createRunExecutionData)({
            executionData: {
                nodeExecutionStack,
            },
            manualData: {
                userId,
            },
        });
        return { nodes, connections, executionData };
    }
    buildTitleGenerationWorkflow(userId, sessionId, credentials, model, humanMessage) {
        const chatTriggerNode = this.buildChatTriggerNode();
        const titleGeneratorAgentNode = this.buildTitleGeneratorAgentNode();
        const modelNode = this.buildModelNode(credentials, model);
        const nodes = [chatTriggerNode, titleGeneratorAgentNode, modelNode];
        const connections = {
            [chat_hub_constants_1.NODE_NAMES.CHAT_TRIGGER]: {
                [n8n_workflow_1.NodeConnectionTypes.Main]: [
                    [{ node: chat_hub_constants_1.NODE_NAMES.TITLE_GENERATOR_AGENT, type: n8n_workflow_1.NodeConnectionTypes.Main, index: 0 }],
                ],
            },
            [chat_hub_constants_1.NODE_NAMES.CHAT_MODEL]: {
                [n8n_workflow_1.NodeConnectionTypes.AiLanguageModel]: [
                    [
                        {
                            node: chat_hub_constants_1.NODE_NAMES.TITLE_GENERATOR_AGENT,
                            type: n8n_workflow_1.NodeConnectionTypes.AiLanguageModel,
                            index: 0,
                        },
                    ],
                ],
            },
        };
        const nodeExecutionStack = [
            {
                node: chatTriggerNode,
                data: {
                    [n8n_workflow_1.NodeConnectionTypes.Main]: [
                        [
                            {
                                json: {
                                    sessionId,
                                    action: 'sendMessage',
                                    chatInput: humanMessage,
                                },
                            },
                        ],
                    ],
                },
                source: null,
            },
        ];
        const executionData = (0, n8n_workflow_1.createRunExecutionData)({
            executionData: {
                nodeExecutionStack,
            },
            manualData: {
                userId,
            },
        });
        return { nodes, connections, executionData };
    }
    buildChatTriggerNode() {
        return {
            parameters: {},
            type: n8n_workflow_1.CHAT_TRIGGER_NODE_TYPE,
            typeVersion: 1.4,
            position: [-448, -112],
            id: (0, uuid_1.v4)(),
            name: chat_hub_constants_1.NODE_NAMES.CHAT_TRIGGER,
            webhookId: (0, uuid_1.v4)(),
        };
    }
    buildToolsAgentNode(model, systemMessage) {
        return {
            parameters: {
                promptType: 'define',
                text: `={{ $('${chat_hub_constants_1.NODE_NAMES.CHAT_TRIGGER}').item.json.chatInput }}`,
                options: {
                    enableStreaming: true,
                    maxTokensFromMemory: model.provider !== 'n8n' && model.provider !== 'custom-agent'
                        ? (0, context_limits_1.getMaxContextWindowTokens)(model.provider, model.model)
                        : undefined,
                    systemMessage,
                },
            },
            type: n8n_workflow_1.AGENT_LANGCHAIN_NODE_TYPE,
            typeVersion: 3,
            position: [608, 0],
            id: (0, uuid_1.v4)(),
            name: chat_hub_constants_1.NODE_NAMES.REPLY_AGENT,
        };
    }
    buildModelNode(credentials, conversationModel) {
        if (conversationModel.provider === 'n8n' || conversationModel.provider === 'custom-agent') {
            throw new n8n_workflow_1.OperationalError('Custom agent workflows do not require a model node');
        }
        const { provider, model } = conversationModel;
        const common = {
            position: [608, 304],
            id: (0, uuid_1.v4)(),
            name: chat_hub_constants_1.NODE_NAMES.CHAT_MODEL,
            credentials,
            type: chat_hub_constants_1.PROVIDER_NODE_TYPE_MAP[provider].name,
            typeVersion: chat_hub_constants_1.PROVIDER_NODE_TYPE_MAP[provider].version,
        };
        switch (provider) {
            case 'openai':
                return {
                    ...common,
                    parameters: {
                        model: { __rl: true, mode: 'id', value: model },
                        options: {},
                    },
                };
            case 'anthropic':
                return {
                    ...common,
                    parameters: {
                        model: {
                            __rl: true,
                            mode: 'id',
                            value: model,
                            cachedResultName: model,
                        },
                        options: {},
                    },
                };
            case 'google':
                return {
                    ...common,
                    parameters: {
                        model: { __rl: true, mode: 'id', value: model },
                        options: {},
                    },
                };
            case 'azureOpenAi':
            case 'azureEntraId':
                return {
                    ...common,
                    parameters: {
                        model,
                        options: {},
                    },
                };
            case 'ollama': {
                return {
                    ...common,
                    parameters: {
                        model: { __rl: true, mode: 'id', value: model },
                        options: {},
                    },
                };
            }
            case 'awsBedrock': {
                return {
                    ...common,
                    parameters: {
                        model,
                        options: {},
                    },
                };
            }
            case 'vercelAiGateway': {
                return {
                    ...common,
                    parameters: {
                        model,
                        options: {},
                    },
                };
            }
            case 'xAiGrok': {
                return {
                    ...common,
                    parameters: {
                        model,
                        options: {},
                    },
                };
            }
            case 'groq': {
                return {
                    ...common,
                    parameters: {
                        model,
                        options: {},
                    },
                };
            }
            case 'openRouter': {
                return {
                    ...common,
                    parameters: {
                        model,
                        options: {},
                    },
                };
            }
            case 'deepSeek': {
                return {
                    ...common,
                    parameters: {
                        model,
                        options: {},
                    },
                };
            }
            case 'cohere': {
                return {
                    ...common,
                    parameters: {
                        model,
                        options: {},
                    },
                };
            }
            case 'mistralCloud': {
                return {
                    ...common,
                    parameters: {
                        model,
                        options: {},
                    },
                };
            }
            default:
                throw new n8n_workflow_1.OperationalError('Unsupported model provider');
        }
    }
    buildMemoryNode(contextWindowLength) {
        return {
            parameters: {
                sessionIdType: 'customKey',
                sessionKey: `={{ $('${chat_hub_constants_1.NODE_NAMES.CHAT_TRIGGER}').item.json.sessionId }}`,
                contextWindowLength,
            },
            type: n8n_workflow_1.MEMORY_BUFFER_WINDOW_NODE_TYPE,
            typeVersion: 1.3,
            position: [224, 304],
            id: (0, uuid_1.v4)(),
            name: chat_hub_constants_1.NODE_NAMES.MEMORY,
        };
    }
    buildRestoreMemoryNode(history) {
        return {
            parameters: {
                mode: 'insert',
                insertMode: 'override',
                messages: {
                    messageValues: history
                        .filter((message) => message.content.length > 0)
                        .map((message) => {
                        const typeMap = {
                            human: 'user',
                            ai: 'ai',
                            system: 'system',
                        };
                        return {
                            type: typeMap[message.type] || 'system',
                            message: message.content,
                            hideFromUI: false,
                        };
                    }),
                },
            },
            type: n8n_workflow_1.MEMORY_MANAGER_NODE_TYPE,
            typeVersion: 1.1,
            position: [-192, 48],
            id: (0, uuid_1.v4)(),
            name: chat_hub_constants_1.NODE_NAMES.RESTORE_CHAT_MEMORY,
        };
    }
    buildClearMemoryNode() {
        return {
            parameters: {
                mode: 'delete',
                deleteMode: 'all',
            },
            type: n8n_workflow_1.MEMORY_MANAGER_NODE_TYPE,
            typeVersion: 1.1,
            position: [976, 0],
            id: (0, uuid_1.v4)(),
            name: chat_hub_constants_1.NODE_NAMES.CLEAR_CHAT_MEMORY,
        };
    }
    buildMergeNode() {
        return {
            parameters: {
                mode: 'combine',
                fieldsToMatchString: 'chatInput',
                joinMode: 'enrichInput1',
                options: {},
            },
            type: n8n_workflow_1.MERGE_NODE_TYPE,
            typeVersion: 3.2,
            position: [224, -96],
            id: (0, uuid_1.v4)(),
            name: chat_hub_constants_1.NODE_NAMES.MERGE,
        };
    }
    buildTitleGeneratorAgentNode() {
        return {
            parameters: {
                promptType: 'define',
                text: `={{ $('${chat_hub_constants_1.NODE_NAMES.CHAT_TRIGGER}').item.json.chatInput }}`,
                options: {
                    enableStreaming: false,
                    systemMessage: chat_hub_constants_1.CONVERSATION_TITLE_GENERATION_PROMPT,
                },
            },
            type: n8n_workflow_1.AGENT_LANGCHAIN_NODE_TYPE,
            typeVersion: 3,
            position: [600, 0],
            id: (0, uuid_1.v4)(),
            name: chat_hub_constants_1.NODE_NAMES.TITLE_GENERATOR_AGENT,
        };
    }
};
exports.ChatHubWorkflowService = ChatHubWorkflowService;
exports.ChatHubWorkflowService = ChatHubWorkflowService = __decorate([
    (0, di_1.Service)(),
    __metadata("design:paramtypes", [backend_common_1.Logger,
        db_1.WorkflowRepository,
        db_1.SharedWorkflowRepository])
], ChatHubWorkflowService);
//# sourceMappingURL=chat-hub-workflow.service.js.map