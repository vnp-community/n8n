"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApproveConsentRequestDto = void 0;
const zod_1 = require("zod");
const zod_class_1 = require("zod-class");
class ApproveConsentRequestDto extends zod_class_1.Z.class({
    approved: zod_1.z.boolean(),
}) {
}
exports.ApproveConsentRequestDto = ApproveConsentRequestDto;
//# sourceMappingURL=approve-consent-request.dto.js.map