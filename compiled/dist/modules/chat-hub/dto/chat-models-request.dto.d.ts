import { Z } from 'zod-class';
declare const ChatModelsRequestDto_base: Z.Class<{
    credentials: import("zod").ZodRecord<import("zod").ZodEnum<["openai", "anthropic", "google", "azureOpenAi", "azureEntraId", "ollama", "awsBedrock", "vercelAiGateway", "xAiGrok", "groq", "openRouter", "deepSeek", "cohere", "mistralCloud", "n8n", "custom-agent"]>, import("zod").ZodNullable<import("zod").ZodString>>;
}>;
export declare class ChatModelsRequestDto extends ChatModelsRequestDto_base {
}
export {};
