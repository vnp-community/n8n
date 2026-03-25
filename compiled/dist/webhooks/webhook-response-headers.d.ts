import type { Response } from 'express';
export type WebhookNodeResponseHeaders = {
    entries?: Array<{
        name: string;
        value: string;
    }>;
};
export declare class WebhookResponseHeaders {
    private headers;
    static fromObject(obj: object): WebhookResponseHeaders;
    set(name: string, value: string): void;
    addFromObject(obj: object): void;
    addFromNodeHeaders(nodeHeaders: WebhookNodeResponseHeaders): void;
    applyToResponse(res: Response): void;
}
