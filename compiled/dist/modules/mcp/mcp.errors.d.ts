import { UserError } from 'n8n-workflow';
import { AuthError } from '../../errors/response-errors/auth.error';
export declare class McpExecutionTimeoutError extends UserError {
    executionId: string | null;
    timeoutMs: number;
    constructor(executionId: string | null, timeoutMs: number);
}
export declare class JWTVerificationError extends AuthError {
    constructor();
}
export declare class AccessTokenNotFoundError extends AuthError {
    constructor();
}
