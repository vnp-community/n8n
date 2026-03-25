import type { ChatHubLLMProvider } from '@n8n/api-types';
import type { INodeTypeNameVersion } from 'n8n-workflow';
export declare const CONVERSATION_TITLE_GENERATION_PROMPT = "Generate a concise, descriptive title for this conversation based on the user's message.\n\nRequirements:\n- 2 to 5 words\n- Use normal sentence case (not title case)\n- No quotation marks\n- Only output the title, nothing else\n- Use the same language as the user's message\n";
export declare const PROVIDER_NODE_TYPE_MAP: Record<ChatHubLLMProvider, INodeTypeNameVersion>;
export declare const NODE_NAMES: {
    readonly CHAT_TRIGGER: "When chat message received";
    readonly REPLY_AGENT: "AI Agent";
    readonly TITLE_GENERATOR_AGENT: "Title Generator Agent";
    readonly CHAT_MODEL: "Chat Model";
    readonly MEMORY: "Memory";
    readonly RESTORE_CHAT_MEMORY: "Restore Chat Memory";
    readonly CLEAR_CHAT_MEMORY: "Clear Chat Memory";
    readonly MERGE: "Merge";
};
export declare const JSONL_STREAM_HEADERS: {
    'Content-Type': string;
    'Transfer-Encoding': string;
    'Cache-Control': string;
    Connection: string;
};
