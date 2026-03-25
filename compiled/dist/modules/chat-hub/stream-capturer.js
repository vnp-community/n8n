"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.interceptResponseWrites = interceptResponseWrites;
exports.createStructuredChunkAggregator = createStructuredChunkAggregator;
const uuid_1 = require("uuid");
function interceptResponseWrites(res, transform) {
    const originalWrite = res.write.bind(res);
    const defaultEncoding = 'utf8';
    const toText = (data, enc) => Buffer.isBuffer(data) ? data.toString(enc ?? defaultEncoding) : String(data);
    function write(chunk, encodingOrCallback, callbackFn) {
        const inputText = toText(chunk, typeof encodingOrCallback === 'string' ? encodingOrCallback : undefined);
        const outputText = transform(inputText);
        if (!encodingOrCallback) {
            return originalWrite(outputText);
        }
        else if (typeof encodingOrCallback === 'function') {
            return originalWrite(outputText, encodingOrCallback);
        }
        else {
            return originalWrite(outputText, encodingOrCallback, callbackFn);
        }
    }
    res.write = write;
    return res;
}
const keyOf = (m) => `${m.nodeId}|${m.runIndex}|${m.itemIndex}`;
function createStructuredChunkAggregator(initialPreviousMessageId, retryOfMessageId, handlers = {}) {
    const { onBegin, onItem, onEnd, onError } = handlers;
    const active = new Map();
    const activeByKey = new Map();
    let previousMessageId = initialPreviousMessageId;
    const startNew = () => {
        const message = {
            id: (0, uuid_1.v4)(),
            previousMessageId,
            retryOfMessageId: retryOfMessageId && previousMessageId === initialPreviousMessageId
                ? retryOfMessageId
                : null,
            content: '',
            createdAt: new Date(),
            updatedAt: new Date(),
            status: 'running',
        };
        previousMessageId = message.id;
        onBegin?.(message);
        return message;
    };
    const ensureMessage = (key) => {
        let message = activeByKey.get(key);
        if (!message) {
            message = startNew();
            activeByKey.set(key, message);
        }
        return message;
    };
    const ingest = (chunk) => {
        const { type, content, metadata } = chunk;
        const key = keyOf(metadata);
        if (type === 'begin') {
            if (activeByKey.has(key)) {
                throw new Error(`Duplicate begin for key ${key}`);
            }
            const message = startNew();
            activeByKey.set(key, message);
            return message;
        }
        if (type === 'item') {
            const message = ensureMessage(key);
            if (typeof content === 'string' && content.length) {
                message.content += content;
                onItem?.(message, content);
            }
            return message;
        }
        if (type === 'end') {
            const message = ensureMessage(key);
            message.status = 'success';
            message.updatedAt = new Date();
            activeByKey.delete(key);
            onEnd?.(message);
            return message;
        }
        const message = ensureMessage(key);
        message.status = 'error';
        message.updatedAt = new Date();
        if (typeof content === 'string') {
            message.content = (message.content ? message.content + '\n\n' : '') + content;
        }
        activeByKey.delete(key);
        onError?.(message, content);
        return message;
    };
    const finalizeAll = () => {
        for (const message of active.values()) {
            message.status = 'cancelled';
            message.updatedAt = new Date();
        }
        active.clear();
    };
    return { ingest, finalizeAll };
}
//# sourceMappingURL=stream-capturer.js.map