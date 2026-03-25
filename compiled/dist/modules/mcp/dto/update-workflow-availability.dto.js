"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateWorkflowAvailabilityDto = void 0;
const zod_1 = require("zod");
const zod_class_1 = require("zod-class");
class UpdateWorkflowAvailabilityDto extends zod_class_1.Z.class({
    availableInMCP: zod_1.z.boolean(),
}) {
}
exports.UpdateWorkflowAvailabilityDto = UpdateWorkflowAvailabilityDto;
//# sourceMappingURL=update-workflow-availability.dto.js.map