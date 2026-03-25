"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validChatTriggerParamsShape = void 0;
const zod_1 = require("zod");
exports.validChatTriggerParamsShape = zod_1.z.object({
    availableInChat: zod_1.z.literal(true),
    agentName: zod_1.z.string().min(1).optional(),
    agentDescription: zod_1.z.string().min(1).optional(),
    options: zod_1.z
        .object({
        allowFileUploads: zod_1.z.boolean().optional(),
    })
        .optional(),
});
//# sourceMappingURL=chat-hub.types.js.map