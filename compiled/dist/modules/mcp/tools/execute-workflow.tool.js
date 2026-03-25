"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeWorkflow = exports.createExecuteWorkflowTool = void 0;
const constants_1 = require("@n8n/constants");
const moment_timezone_1 = __importDefault(require("moment-timezone"));
const n8n_workflow_1 = require("n8n-workflow");
const zod_1 = __importDefault(require("zod"));
const mcp_constants_1 = require("../mcp.constants");
const mcp_errors_1 = require("../mcp.errors");
const mcp_utils_1 = require("../mcp.utils");
const WORKFLOW_EXECUTION_TIMEOUT_MS = 5 * constants_1.Time.minutes.toMilliseconds;
const inputSchema = zod_1.default.object({
    workflowId: zod_1.default.string().describe('The ID of the workflow to execute'),
    inputs: zod_1.default
        .discriminatedUnion('type', [
        zod_1.default.object({
            type: zod_1.default.literal('chat'),
            chatInput: zod_1.default.string().describe('Input for chat-based workflows'),
        }),
        zod_1.default.object({
            type: zod_1.default.literal('form'),
            formData: zod_1.default.record(zod_1.default.unknown()).describe('Input data for form-based workflows'),
        }),
        zod_1.default.object({
            type: zod_1.default.literal('webhook'),
            webhookData: zod_1.default
                .object({
                method: zod_1.default
                    .enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])
                    .optional()
                    .default('GET')
                    .describe('HTTP method (defaults to GET)'),
                query: zod_1.default.record(zod_1.default.string()).optional().describe('Query string parameters'),
                body: zod_1.default
                    .record(zod_1.default.unknown())
                    .optional()
                    .describe('Request body data (main webhook payload)'),
                headers: zod_1.default
                    .record(zod_1.default.string())
                    .optional()
                    .describe('HTTP headers (e.g., authorization, content-type)'),
            })
                .describe('Input data for webhook-based workflows'),
        }),
    ])
        .optional()
        .describe('Inputs to provide to the workflow.'),
});
const outputSchema = {
    success: zod_1.default.boolean(),
    executionId: zod_1.default.string().nullable().optional(),
    result: zod_1.default.unknown().optional().describe('Workflow execution result data'),
    error: zod_1.default.unknown().optional(),
};
const createExecuteWorkflowTool = (user, workflowFinderService, activeExecutions, workflowRunner, telemetry) => ({
    name: 'execute_workflow',
    config: {
        description: 'Execute a workflow by ID. Before executing always ensure you know the input schema by first using the get_workflow_details tool and consulting workflow description',
        inputSchema: inputSchema.shape,
        outputSchema,
        annotations: {
            title: 'Execute Workflow',
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: true,
            openWorldHint: true,
        },
    },
    handler: async ({ workflowId, inputs }) => {
        const telemetryPayload = {
            user_id: user.id,
            tool_name: 'execute_workflow',
            parameters: { workflowId, inputs: getInputMetaData(inputs) },
        };
        try {
            const output = await (0, exports.executeWorkflow)(user, workflowFinderService, activeExecutions, workflowRunner, workflowId, inputs);
            telemetryPayload.results = {
                success: output.success,
                data: {
                    executionId: output.executionId,
                },
            };
            telemetry.track(mcp_constants_1.USER_CALLED_MCP_TOOL_EVENT, telemetryPayload);
            return {
                content: [{ type: 'text', text: (0, n8n_workflow_1.jsonStringify)(output) }],
                structuredContent: output,
            };
        }
        catch (er) {
            const error = (0, n8n_workflow_1.ensureError)(er);
            const isTimeout = error instanceof mcp_errors_1.McpExecutionTimeoutError;
            const output = {
                success: false,
                executionId: isTimeout ? error.executionId : null,
                error: isTimeout
                    ? `Workflow execution timed out after ${WORKFLOW_EXECUTION_TIMEOUT_MS / constants_1.Time.milliseconds.toSeconds} seconds`
                    : error.message,
            };
            telemetryPayload.results = {
                success: false,
                error: isTimeout ? 'Workflow execution timed out' : error.message,
            };
            telemetry.track(mcp_constants_1.USER_CALLED_MCP_TOOL_EVENT, telemetryPayload);
            return {
                content: [{ type: 'text', text: (0, n8n_workflow_1.jsonStringify)(output) }],
                structuredContent: output,
            };
        }
    },
});
exports.createExecuteWorkflowTool = createExecuteWorkflowTool;
const executeWorkflow = async (user, workflowFinderService, activeExecutions, workflowRunner, workflowId, inputs) => {
    const workflow = await workflowFinderService.findWorkflowForUser(workflowId, user, ['workflow:execute'], { includeActiveVersion: true });
    if (!workflow || workflow.isArchived) {
        throw new n8n_workflow_1.UserError('Workflow not found');
    }
    if (!workflow.settings?.availableInMCP) {
        throw new n8n_workflow_1.UserError('Workflow is not available for execution via MCP. Enable access in the workflow settings to make it available.');
    }
    const nodes = workflow.activeVersion?.nodes ?? [];
    const connections = workflow.activeVersion?.connections ?? {};
    const triggerNode = (0, mcp_utils_1.findMcpSupportedTrigger)(nodes);
    if (!triggerNode) {
        throw new n8n_workflow_1.UserError(`Only workflows with the following trigger nodes can be executed: ${Object.values(mcp_constants_1.SUPPORTED_MCP_TRIGGERS).join(', ')}.`);
    }
    const runData = {
        executionMode: getExecutionModeForTrigger(triggerNode),
        workflowData: { ...workflow, nodes, connections },
        userId: user.id,
    };
    runData.startNodes = [{ name: triggerNode.name, sourceData: null }];
    runData.pinData = getPinDataForTrigger(triggerNode, inputs);
    runData.executionData = (0, n8n_workflow_1.createRunExecutionData)({
        startData: {},
        resultData: {
            pinData: runData.pinData,
            runData: {},
        },
        executionData: {
            contextData: {},
            metadata: {},
            nodeExecutionStack: [
                {
                    node: triggerNode,
                    data: {
                        main: [runData.pinData[triggerNode.name]],
                    },
                    source: null,
                },
            ],
            waitingExecution: {},
            waitingExecutionSource: {},
        },
    });
    const executionId = await workflowRunner.run(runData);
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new mcp_errors_1.McpExecutionTimeoutError(executionId, WORKFLOW_EXECUTION_TIMEOUT_MS));
        }, WORKFLOW_EXECUTION_TIMEOUT_MS);
    });
    try {
        const data = await Promise.race([
            activeExecutions.getPostExecutePromise(executionId),
            timeoutPromise,
        ]);
        clearTimeout(timeoutId);
        if (data === undefined) {
            throw new n8n_workflow_1.UnexpectedError('Workflow did not return any data');
        }
        return {
            success: data.status !== 'error' && !data.data.resultData?.error,
            executionId,
            result: data.data.resultData,
            error: data.data.resultData?.error,
        };
    }
    catch (error) {
        if (timeoutId)
            clearTimeout(timeoutId);
        if (error instanceof mcp_errors_1.McpExecutionTimeoutError) {
            try {
                const cancellationError = new n8n_workflow_1.TimeoutExecutionCancelledError(error.executionId);
                activeExecutions.stopExecution(error.executionId, cancellationError);
            }
            catch (stopError) {
                throw new n8n_workflow_1.UnexpectedError(`Failed to stop timed-out execution [id: ${error.executionId}]: ${(0, n8n_workflow_1.ensureError)(stopError).message}`);
            }
        }
        throw error;
    }
};
exports.executeWorkflow = executeWorkflow;
const getExecutionModeForTrigger = (node) => {
    switch (node.type) {
        case n8n_workflow_1.WEBHOOK_NODE_TYPE:
            return 'webhook';
        case n8n_workflow_1.CHAT_TRIGGER_NODE_TYPE:
            return 'chat';
        case n8n_workflow_1.FORM_TRIGGER_NODE_TYPE:
            return 'trigger';
        default:
            return 'trigger';
    }
};
const getPinDataForTrigger = (node, inputs) => {
    switch (node.type) {
        case n8n_workflow_1.WEBHOOK_NODE_TYPE: {
            const webhookData = inputs?.type === 'webhook' ? inputs.webhookData : undefined;
            return {
                [node.name]: [
                    {
                        json: {
                            headers: webhookData?.headers ?? {},
                            query: webhookData?.query ?? {},
                            body: webhookData?.body ?? {},
                        },
                    },
                ],
            };
        }
        case n8n_workflow_1.CHAT_TRIGGER_NODE_TYPE:
            if (!inputs || inputs.type !== 'chat')
                return {};
            return {
                [node.name]: [
                    {
                        json: {
                            sessionId: `mcp-session-${Date.now()}`,
                            action: 'sendMessage',
                            chatInput: inputs.chatInput,
                        },
                    },
                ],
            };
        case n8n_workflow_1.FORM_TRIGGER_NODE_TYPE:
            if (!inputs || inputs.type !== 'form')
                return {};
            return {
                [node.name]: [
                    {
                        json: {
                            submittedAt: new Date().toISOString(),
                            formMode: 'mcp',
                            ...(inputs.formData ?? {}),
                        },
                    },
                ],
            };
        case n8n_workflow_1.SCHEDULE_TRIGGER_NODE_TYPE: {
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const momentTz = moment_timezone_1.default.tz(timezone);
            return {
                [node.name]: [
                    {
                        json: {
                            timestamp: momentTz.toISOString(true),
                            'Readable date': momentTz.format('MMMM Do YYYY, h:mm:ss a'),
                            'Readable time': momentTz.format('h:mm:ss a'),
                            'Day of week': momentTz.format('dddd'),
                            Year: momentTz.format('YYYY'),
                            Month: momentTz.format('MMMM'),
                            'Day of month': momentTz.format('DD'),
                            Hour: momentTz.format('HH'),
                            Minute: momentTz.format('mm'),
                            Second: momentTz.format('ss'),
                            Timezone: `${timezone} (UTC${momentTz.format('Z')})`,
                        },
                    },
                ],
            };
        }
        default:
            return {};
    }
};
const getInputMetaData = (inputs) => {
    if (!inputs) {
        return undefined;
    }
    switch (inputs.type) {
        case 'chat':
            return {
                type: 'chat',
                parameter_count: 1,
            };
        case 'form':
            return {
                type: 'form',
                parameter_count: Object.keys(inputs.formData ?? {}).length,
            };
        case 'webhook':
            return {
                type: 'webhook',
                parameter_count: [
                    inputs.webhookData?.body ? Object.keys(inputs.webhookData.body).length : 0,
                    inputs.webhookData?.query ? Object.keys(inputs.webhookData.query).length : 0,
                    inputs.webhookData?.headers ? Object.keys(inputs.webhookData.headers).length : 0,
                ].reduce((a, b) => a + b, 0),
            };
        default:
            return undefined;
    }
};
//# sourceMappingURL=execute-workflow.tool.js.map