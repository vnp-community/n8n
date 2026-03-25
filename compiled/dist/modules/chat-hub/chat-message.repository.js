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
exports.ChatHubMessageRepository = void 0;
const db_1 = require("@n8n/db");
const di_1 = require("@n8n/di");
const typeorm_1 = require("@n8n/typeorm");
const chat_hub_message_entity_1 = require("./chat-hub-message.entity");
const chat_session_repository_1 = require("./chat-session.repository");
const n8n_workflow_1 = require("n8n-workflow");
let ChatHubMessageRepository = class ChatHubMessageRepository extends typeorm_1.Repository {
    constructor(dataSource, chatSessionRepository) {
        super(chat_hub_message_entity_1.ChatHubMessage, dataSource.manager);
        this.chatSessionRepository = chatSessionRepository;
    }
    async createChatMessage(message, trx) {
        const messageId = message.id;
        if (typeof messageId === 'function') {
            throw new n8n_workflow_1.UnexpectedError('Message ID is required and must be a string value');
        }
        return await (0, db_1.withTransaction)(this.manager, trx, async (em) => {
            await em.insert(chat_hub_message_entity_1.ChatHubMessage, message);
            const saved = await em.findOneOrFail(chat_hub_message_entity_1.ChatHubMessage, {
                where: { id: messageId },
            });
            await this.chatSessionRepository.updateLastMessageAt(saved.sessionId, saved.createdAt, em);
            return saved;
        }, false);
    }
    async updateChatMessage(id, fields, trx) {
        return await (0, db_1.withTransaction)(this.manager, trx, async (em) => {
            return await em.update(chat_hub_message_entity_1.ChatHubMessage, { id }, fields);
        }, false);
    }
    async deleteChatMessage(id, trx) {
        return await (0, db_1.withTransaction)(this.manager, trx, async (em) => {
            return await em.delete(chat_hub_message_entity_1.ChatHubMessage, { id });
        }, false);
    }
    async getManyBySessionId(sessionId, trx) {
        return await (0, db_1.withTransaction)(this.manager, trx, async (em) => {
            return await em.find(chat_hub_message_entity_1.ChatHubMessage, {
                where: { sessionId },
                order: { createdAt: 'ASC', id: 'DESC' },
            });
        }, false);
    }
    async getOneById(id, sessionId, relations = [], trx) {
        return await (0, db_1.withTransaction)(this.manager, trx, async (em) => {
            return await em.findOne(chat_hub_message_entity_1.ChatHubMessage, {
                where: { id, sessionId },
                relations,
            });
        }, false);
    }
};
exports.ChatHubMessageRepository = ChatHubMessageRepository;
exports.ChatHubMessageRepository = ChatHubMessageRepository = __decorate([
    (0, di_1.Service)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        chat_session_repository_1.ChatHubSessionRepository])
], ChatHubMessageRepository);
//# sourceMappingURL=chat-message.repository.js.map