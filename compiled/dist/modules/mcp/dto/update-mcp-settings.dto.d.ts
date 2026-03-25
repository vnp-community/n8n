import { z } from 'zod';
import { Z } from 'zod-class';
declare const UpdateMcpSettingsDto_base: Z.Class<{
    mcpAccessEnabled: z.ZodBoolean;
}>;
export declare class UpdateMcpSettingsDto extends UpdateMcpSettingsDto_base {
}
export {};
