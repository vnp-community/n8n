"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateMcpSettingsDto = void 0;
const zod_1 = require("zod");
const zod_class_1 = require("zod-class");
class UpdateMcpSettingsDto extends zod_class_1.Z.class({
    mcpAccessEnabled: zod_1.z.boolean(),
}) {
}
exports.UpdateMcpSettingsDto = UpdateMcpSettingsDto;
//# sourceMappingURL=update-mcp-settings.dto.js.map