"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatModelsRequestDto = void 0;
const api_types_1 = require("@n8n/api-types");
const zod_class_1 = require("zod-class");
class ChatModelsRequestDto extends zod_class_1.Z.class(api_types_1.chatModelsRequestSchema.shape) {
}
exports.ChatModelsRequestDto = ChatModelsRequestDto;
//# sourceMappingURL=chat-models-request.dto.js.map