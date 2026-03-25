"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpService = void 0;
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const config_1 = require("@n8n/config");
const di_1 = require("@n8n/di");
const execute_workflow_tool_1 = require("./tools/execute-workflow.tool");
const get_workflow_details_tool_1 = require("./tools/get-workflow-details.tool");
const search_workflows_tool_1 = require("./tools/search-workflows.tool");
const active_executions_1 = require("../../active-executions");
const credentials_service_1 = require("../../credentials/credentials.service");
const url_service_1 = require("../../services/url.service");
const telemetry_1 = require("../../telemetry");
const workflow_runner_1 = require("../../workflow-runner");
const workflow_finder_service_1 = require("../../workflows/workflow-finder.service");
const workflow_service_1 = require("../../workflows/workflow.service");
let McpService = class McpService {
    constructor(workflowFinderService, workflowService, urlService, credentialsService, activeExecutions, globalConfig, telemetry, workflowRunner) {
        this.workflowFinderService = workflowFinderService;
        this.workflowService = workflowService;
        this.urlService = urlService;
        this.credentialsService = credentialsService;
        this.activeExecutions = activeExecutions;
        this.globalConfig = globalConfig;
        this.telemetry = telemetry;
        this.workflowRunner = workflowRunner;
    }
    getServer(user) {
        const server = new mcp_js_1.McpServer({
            name: 'n8n MCP Server',
            version: '1.0.0',
        });
        const workflowSearchTool = (0, search_workflows_tool_1.createSearchWorkflowsTool)(user, this.workflowService, this.telemetry);
        server.registerTool(workflowSearchTool.name, workflowSearchTool.config, workflowSearchTool.handler);
        const executeWorkflowTool = (0, execute_workflow_tool_1.createExecuteWorkflowTool)(user, this.workflowFinderService, this.activeExecutions, this.workflowRunner, this.telemetry);
        server.registerTool(executeWorkflowTool.name, executeWorkflowTool.config, executeWorkflowTool.handler);
        const workflowDetailsTool = (0, get_workflow_details_tool_1.createWorkflowDetailsTool)(user, this.urlService.getWebhookBaseUrl(), this.workflowFinderService, this.credentialsService, {
            webhook: this.globalConfig.endpoints.webhook,
            webhookTest: this.globalConfig.endpoints.webhookTest,
        }, this.telemetry);
        server.registerTool(workflowDetailsTool.name, workflowDetailsTool.config, workflowDetailsTool.handler);
        return server;
    }
};
exports.McpService = McpService;
exports.McpService = McpService = __decorate([
    (0, di_1.Service)(),
    __metadata("design:paramtypes", [workflow_finder_service_1.WorkflowFinderService,
        workflow_service_1.WorkflowService,
        url_service_1.UrlService,
        credentials_service_1.CredentialsService,
        active_executions_1.ActiveExecutions,
        config_1.GlobalConfig,
        telemetry_1.Telemetry,
        workflow_runner_1.WorkflowRunner])
], McpService);
//# sourceMappingURL=mcp.service.js.map