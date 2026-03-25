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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatHubController = void 0;
const api_types_1 = require("@n8n/api-types");
const backend_common_1 = require("@n8n/backend-common");
const decorators_1 = require("@n8n/decorators");
const utils_1 = require("@n8n/utils");
const n8n_workflow_1 = require("n8n-workflow");
const node_assert_1 = require("node:assert");
const response_error_1 = require("../../errors/response-errors/abstract/response.error");
const bad_request_error_1 = require("../../errors/response-errors/bad-request.error");
const chat_hub_agent_service_1 = require("./chat-hub-agent.service");
const chat_hub_attachment_service_1 = require("./chat-hub.attachment.service");
const chat_hub_service_1 = require("./chat-hub.service");
const chat_models_request_dto_1 = require("./dto/chat-models-request.dto");
let ChatHubController = class ChatHubController {
    constructor(chatService, chatAgentService, chatAttachmentService, logger) {
        this.chatService = chatService;
        this.chatAgentService = chatAgentService;
        this.chatAttachmentService = chatAttachmentService;
        this.logger = logger;
    }
    async getModels(req, _res, payload) {
        return await this.chatService.getModels(req.user, payload.credentials);
    }
    async getConversations(req, _res, query) {
        return await this.chatService.getConversations(req.user.id, query.limit, query.cursor);
    }
    async getConversationMessages(req, _res, sessionId) {
        return await this.chatService.getConversation(req.user.id, sessionId);
    }
    async getMessageAttachment(req, res, sessionId, messageId, index) {
        const attachmentIndex = Number.parseInt(index, 10);
        if (isNaN(attachmentIndex)) {
            throw new bad_request_error_1.BadRequestError('Invalid attachment index');
        }
        await this.chatService.getConversation(req.user.id, sessionId);
        const [{ mimeType, fileName }, attachmentAsStreamOrBuffer] = await this.chatAttachmentService.getAttachment(sessionId, messageId, attachmentIndex);
        res.setHeader('Content-Type', mimeType);
        if (attachmentAsStreamOrBuffer.fileSize) {
            res.setHeader('Content-Length', attachmentAsStreamOrBuffer.fileSize);
        }
        if (!mimeType || !api_types_1.ViewableMimeTypes.includes(mimeType.toLowerCase())) {
            res.setHeader('Content-Disposition', `attachment${fileName ? `; filename=${(0, utils_1.sanitizeFilename)(fileName)}` : ''}`);
        }
        if (attachmentAsStreamOrBuffer.type === 'buffer') {
            res.send(attachmentAsStreamOrBuffer.buffer);
            return;
        }
        return await new Promise((resolve, reject) => {
            attachmentAsStreamOrBuffer.stream.on('end', resolve);
            attachmentAsStreamOrBuffer.stream.on('error', reject);
            attachmentAsStreamOrBuffer.stream.pipe(res);
        });
    }
    async sendMessage(req, res, payload) {
        this.logger.debug(`Chat send request received: ${(0, n8n_workflow_1.jsonStringify)({
            ...payload,
            attachments: payload.attachments?.map((a) => ({
                fileName: a.fileName,
                data: `${a.data.length} characters (Base64)`,
            })),
        })}`);
        try {
            await this.chatService.sendHumanMessage(res, req.user, {
                ...payload,
                userId: req.user.id,
            });
        }
        catch (error) {
            (0, node_assert_1.strict)(error instanceof Error);
            this.logger.error(`Error in chat send endpoint: ${error}`);
            if (!res.headersSent) {
                if (error instanceof response_error_1.ResponseError) {
                    throw error;
                }
                res.status(500).json({
                    code: 500,
                    message: error.message,
                });
            }
            else if (!res.writableEnded) {
                res.write((0, n8n_workflow_1.jsonStringify)({
                    type: 'error',
                    content: error.message,
                }) + '\n');
                res.flush();
            }
            if (!res.writableEnded)
                res.end();
        }
    }
    async editMessage(req, res, sessionId, editId, payload) {
        this.logger.debug(`Chat edit request received: ${(0, n8n_workflow_1.jsonStringify)(payload)}`);
        try {
            await this.chatService.editMessage(res, req.user, {
                ...payload,
                sessionId,
                editId,
                userId: req.user.id,
            });
        }
        catch (error) {
            (0, node_assert_1.strict)(error instanceof Error);
            this.logger.error(`Error in chat edit endpoint: ${error}`);
            if (!res.headersSent) {
                if (error instanceof response_error_1.ResponseError) {
                    throw error;
                }
                res.status(500).json({
                    code: 500,
                    message: error.message,
                });
            }
            else if (!res.writableEnded) {
                res.write((0, n8n_workflow_1.jsonStringify)({
                    type: 'error',
                    content: error.message,
                }) + '\n');
                res.flush();
            }
            if (!res.writableEnded)
                res.end();
        }
    }
    async regenerateMessage(req, res, sessionId, retryId, payload) {
        this.logger.debug(`Chat retry request received: ${(0, n8n_workflow_1.jsonStringify)(payload)}`);
        try {
            await this.chatService.regenerateAIMessage(res, req.user, {
                ...payload,
                sessionId,
                retryId,
                userId: req.user.id,
            });
        }
        catch (error) {
            (0, node_assert_1.strict)(error instanceof Error);
            this.logger.error(`Error in chat retry endpoint: ${error}`);
            if (!res.headersSent) {
                if (error instanceof response_error_1.ResponseError) {
                    throw error;
                }
                res.status(500).json({
                    code: 500,
                    message: error.message,
                });
            }
            else if (!res.writableEnded) {
                res.write((0, n8n_workflow_1.jsonStringify)({
                    type: 'error',
                    content: error.message,
                }) + '\n');
                res.flush();
            }
            if (!res.writableEnded)
                res.end();
        }
    }
    async stopGeneration(req, res, sessionId, messageId) {
        this.logger.debug(`Chat stop request received: ${(0, n8n_workflow_1.jsonStringify)({ sessionId, messageId })}`);
        await this.chatService.stopGeneration(req.user, sessionId, messageId);
        res.status(204).send();
    }
    async updateConversation(req, _res, sessionId, payload) {
        if (Object.keys(payload).length > 0) {
            await this.chatService.updateSession(req.user, sessionId, payload);
        }
        return await this.chatService.getConversation(req.user.id, sessionId);
    }
    async deleteConversation(req, res, sessionId) {
        await this.chatService.deleteSession(req.user.id, sessionId);
        res.status(204).send();
    }
    async getAgents(req) {
        return await this.chatAgentService.getAgentsByUserId(req.user.id);
    }
    async getAgent(req, _res, agentId) {
        return await this.chatAgentService.getAgentById(agentId, req.user.id);
    }
    async createAgent(req, _res, payload) {
        return await this.chatAgentService.createAgent(req.user, payload);
    }
    async updateAgent(req, _res, agentId, payload) {
        return await this.chatAgentService.updateAgent(agentId, req.user, payload);
    }
    async deleteAgent(req, res, agentId) {
        await this.chatAgentService.deleteAgent(agentId, req.user.id);
        res.status(204).send();
    }
};
exports.ChatHubController = ChatHubController;
__decorate([
    (0, decorators_1.Post)('/models'),
    (0, decorators_1.GlobalScope)('chatHub:message'),
    __param(2, decorators_1.Body),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, chat_models_request_dto_1.ChatModelsRequestDto]),
    __metadata("design:returntype", Promise)
], ChatHubController.prototype, "getModels", null);
__decorate([
    (0, decorators_1.Get)('/conversations'),
    (0, decorators_1.GlobalScope)('chatHub:message'),
    __param(2, decorators_1.Query),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, api_types_1.ChatHubConversationsRequest]),
    __metadata("design:returntype", Promise)
], ChatHubController.prototype, "getConversations", null);
__decorate([
    (0, decorators_1.Get)('/conversations/:sessionId'),
    (0, decorators_1.GlobalScope)('chatHub:message'),
    __param(2, (0, decorators_1.Param)('sessionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ChatHubController.prototype, "getConversationMessages", null);
__decorate([
    (0, decorators_1.Get)('/conversations/:sessionId/messages/:messageId/attachments/:index'),
    (0, decorators_1.GlobalScope)('chatHub:message'),
    __param(2, (0, decorators_1.Param)('sessionId')),
    __param(3, (0, decorators_1.Param)('messageId')),
    __param(4, (0, decorators_1.Param)('index')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], ChatHubController.prototype, "getMessageAttachment", null);
__decorate([
    (0, decorators_1.GlobalScope)('chatHub:message'),
    (0, decorators_1.Post)('/conversations/send'),
    __param(2, decorators_1.Body),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, api_types_1.ChatHubSendMessageRequest]),
    __metadata("design:returntype", Promise)
], ChatHubController.prototype, "sendMessage", null);
__decorate([
    (0, decorators_1.GlobalScope)('chatHub:message'),
    (0, decorators_1.Post)('/conversations/:sessionId/messages/:messageId/edit'),
    __param(2, (0, decorators_1.Param)('sessionId')),
    __param(3, (0, decorators_1.Param)('messageId')),
    __param(4, decorators_1.Body),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String, api_types_1.ChatHubEditMessageRequest]),
    __metadata("design:returntype", Promise)
], ChatHubController.prototype, "editMessage", null);
__decorate([
    (0, decorators_1.GlobalScope)('chatHub:message'),
    (0, decorators_1.Post)('/conversations/:sessionId/messages/:messageId/regenerate'),
    __param(2, (0, decorators_1.Param)('sessionId')),
    __param(3, (0, decorators_1.Param)('messageId')),
    __param(4, decorators_1.Body),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String, api_types_1.ChatHubRegenerateMessageRequest]),
    __metadata("design:returntype", Promise)
], ChatHubController.prototype, "regenerateMessage", null);
__decorate([
    (0, decorators_1.GlobalScope)('chatHub:message'),
    (0, decorators_1.Post)('/conversations/:sessionId/messages/:messageId/stop'),
    __param(2, (0, decorators_1.Param)('sessionId')),
    __param(3, (0, decorators_1.Param)('messageId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String]),
    __metadata("design:returntype", Promise)
], ChatHubController.prototype, "stopGeneration", null);
__decorate([
    (0, decorators_1.Patch)('/conversations/:sessionId'),
    (0, decorators_1.GlobalScope)('chatHub:message'),
    __param(2, (0, decorators_1.Param)('sessionId')),
    __param(3, decorators_1.Body),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, api_types_1.ChatHubUpdateConversationRequest]),
    __metadata("design:returntype", Promise)
], ChatHubController.prototype, "updateConversation", null);
__decorate([
    (0, decorators_1.Delete)('/conversations/:sessionId'),
    (0, decorators_1.GlobalScope)('chatHub:message'),
    __param(2, (0, decorators_1.Param)('sessionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ChatHubController.prototype, "deleteConversation", null);
__decorate([
    (0, decorators_1.Get)('/agents'),
    (0, decorators_1.GlobalScope)('chatHubAgent:list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatHubController.prototype, "getAgents", null);
__decorate([
    (0, decorators_1.Get)('/agents/:agentId'),
    (0, decorators_1.GlobalScope)('chatHubAgent:read'),
    __param(2, (0, decorators_1.Param)('agentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ChatHubController.prototype, "getAgent", null);
__decorate([
    (0, decorators_1.Post)('/agents'),
    (0, decorators_1.GlobalScope)('chatHubAgent:create'),
    __param(2, decorators_1.Body),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, api_types_1.ChatHubCreateAgentRequest]),
    __metadata("design:returntype", Promise)
], ChatHubController.prototype, "createAgent", null);
__decorate([
    (0, decorators_1.Post)('/agents/:agentId'),
    (0, decorators_1.GlobalScope)('chatHubAgent:update'),
    __param(2, (0, decorators_1.Param)('agentId')),
    __param(3, decorators_1.Body),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, api_types_1.ChatHubUpdateAgentRequest]),
    __metadata("design:returntype", Promise)
], ChatHubController.prototype, "updateAgent", null);
__decorate([
    (0, decorators_1.Delete)('/agents/:agentId'),
    (0, decorators_1.GlobalScope)('chatHubAgent:delete'),
    __param(2, (0, decorators_1.Param)('agentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ChatHubController.prototype, "deleteAgent", null);
exports.ChatHubController = ChatHubController = __decorate([
    (0, decorators_1.RestController)('/chat'),
    __metadata("design:paramtypes", [chat_hub_service_1.ChatHubService,
        chat_hub_agent_service_1.ChatHubAgentService,
        chat_hub_attachment_service_1.ChatHubAttachmentService,
        backend_common_1.Logger])
], ChatHubController);
//# sourceMappingURL=chat-hub.controller.js.map