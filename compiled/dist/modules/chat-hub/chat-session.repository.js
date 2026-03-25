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
exports.ChatHubSessionRepository = void 0;
const db_1 = require("@n8n/db");
const di_1 = require("@n8n/di");
const typeorm_1 = require("@n8n/typeorm");
const chat_hub_session_entity_1 = require("./chat-hub-session.entity");
const not_found_error_1 = require("../../errors/response-errors/not-found.error");
let ChatHubSessionRepository = class ChatHubSessionRepository extends typeorm_1.Repository {
    constructor(dataSource) {
        super(chat_hub_session_entity_1.ChatHubSession, dataSource.manager);
    }
    async createChatSession(session, trx) {
        return await (0, db_1.withTransaction)(this.manager, trx, async (em) => {
            await em.insert(chat_hub_session_entity_1.ChatHubSession, session);
            return await em.findOneOrFail(chat_hub_session_entity_1.ChatHubSession, {
                where: { id: session.id },
                relations: ['messages'],
            });
        });
    }
    async updateLastMessageAt(id, lastMessageAt, trx) {
        return await (0, db_1.withTransaction)(this.manager, trx, async (em) => {
            await em.update(chat_hub_session_entity_1.ChatHubSession, { id }, { lastMessageAt });
            return await em.findOneOrFail(chat_hub_session_entity_1.ChatHubSession, {
                where: { id },
                relations: ['messages'],
            });
        });
    }
    async updateChatTitle(id, title, trx) {
        return await (0, db_1.withTransaction)(this.manager, trx, async (em) => {
            await em.update(chat_hub_session_entity_1.ChatHubSession, { id }, { title });
            return await em.findOneOrFail(chat_hub_session_entity_1.ChatHubSession, {
                where: { id },
                relations: ['messages'],
            });
        });
    }
    async updateChatSession(id, updates, trx) {
        return await (0, db_1.withTransaction)(this.manager, trx, async (em) => {
            await em.update(chat_hub_session_entity_1.ChatHubSession, { id }, updates);
            return await em.findOneOrFail(chat_hub_session_entity_1.ChatHubSession, {
                where: { id },
                relations: ['messages'],
            });
        });
    }
    async deleteChatHubSession(id, trx) {
        return await (0, db_1.withTransaction)(this.manager, trx, async (em) => {
            return await em.delete(chat_hub_session_entity_1.ChatHubSession, { id });
        });
    }
    async getManyByUserId(userId, limit, cursor) {
        const queryBuilder = this.createQueryBuilder('session')
            .where('session.ownerId = :userId', { userId })
            .orderBy("COALESCE(session.lastMessageAt, '1970-01-01')", 'DESC')
            .addOrderBy('session.id', 'ASC');
        if (cursor) {
            const cursorSession = await this.findOne({
                where: { id: cursor, ownerId: userId },
            });
            if (!cursorSession) {
                throw new not_found_error_1.NotFoundError('Cursor session not found');
            }
            queryBuilder.andWhere('(session.lastMessageAt < :lastMessageAt OR (session.lastMessageAt = :lastMessageAt AND session.id > :id))', {
                lastMessageAt: cursorSession.lastMessageAt,
                id: cursorSession.id,
            });
        }
        queryBuilder.take(limit);
        return await queryBuilder.getMany();
    }
    async getOneById(id, userId, trx) {
        return await (0, db_1.withTransaction)(this.manager, trx, async (em) => {
            return await em.findOne(chat_hub_session_entity_1.ChatHubSession, {
                where: { id, ownerId: userId },
                relations: ['messages'],
            });
        }, false);
    }
    async deleteAll(trx) {
        return await (0, db_1.withTransaction)(this.manager, trx, async (em) => {
            return await em.createQueryBuilder().delete().from(chat_hub_session_entity_1.ChatHubSession).execute();
        });
    }
};
exports.ChatHubSessionRepository = ChatHubSessionRepository;
exports.ChatHubSessionRepository = ChatHubSessionRepository = __decorate([
    (0, di_1.Service)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], ChatHubSessionRepository);
//# sourceMappingURL=chat-session.repository.js.map