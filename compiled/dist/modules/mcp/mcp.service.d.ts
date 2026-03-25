import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GlobalConfig } from '@n8n/config';
import { User } from '@n8n/db';
import { ActiveExecutions } from '../../active-executions';
import { CredentialsService } from '../../credentials/credentials.service';
import { UrlService } from '../../services/url.service';
import { Telemetry } from '../../telemetry';
import { WorkflowRunner } from '../../workflow-runner';
import { WorkflowFinderService } from '../../workflows/workflow-finder.service';
import { WorkflowService } from '../../workflows/workflow.service';
export declare class McpService {
    private readonly workflowFinderService;
    private readonly workflowService;
    private readonly urlService;
    private readonly credentialsService;
    private readonly activeExecutions;
    private readonly globalConfig;
    private readonly telemetry;
    private readonly workflowRunner;
    constructor(workflowFinderService: WorkflowFinderService, workflowService: WorkflowService, urlService: UrlService, credentialsService: CredentialsService, activeExecutions: ActiveExecutions, globalConfig: GlobalConfig, telemetry: Telemetry, workflowRunner: WorkflowRunner);
    getServer(user: User): McpServer;
}
