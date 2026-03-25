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
exports.WorkflowIndexService = void 0;
const backend_common_1 = require("@n8n/backend-common");
const db_1 = require("@n8n/db");
const di_1 = require("@n8n/di");
const n8n_core_1 = require("n8n-core");
const n8n_workflow_1 = require("n8n-workflow");
const event_service_1 = require("../../events/event.service");
const LOOP_LIMIT = 1_000_000_000;
let WorkflowIndexService = class WorkflowIndexService {
    constructor(dependencyRepository, workflowRepository, eventService, logger, errorReporter, batchSize = 100) {
        this.dependencyRepository = dependencyRepository;
        this.workflowRepository = workflowRepository;
        this.eventService = eventService;
        this.logger = logger;
        this.errorReporter = errorReporter;
        this.batchSize = batchSize;
    }
    init() {
        this.eventService.on('server-started', async () => {
            this.logger.info('Building workflow dependency index...');
            await this.buildIndex().catch((e) => this.errorReporter.error(e));
        });
        this.eventService.on('workflow-created', async ({ workflow }) => {
            await this.updateIndexFor(workflow);
        });
        this.eventService.on('workflow-saved', async ({ workflow }) => {
            await this.updateIndexFor(workflow);
        });
        this.eventService.on('workflow-deleted', async ({ workflowId }) => {
            await this.dependencyRepository.removeDependenciesForWorkflow(workflowId);
        });
    }
    async buildIndex() {
        const batchSize = this.batchSize;
        let processedCount = 0;
        while (processedCount < LOOP_LIMIT) {
            const workflows = await this.workflowRepository.findWorkflowsNeedingIndexing(batchSize);
            if (workflows.length === 0) {
                break;
            }
            for (const workflow of workflows) {
                await this.updateIndexFor(workflow);
            }
            processedCount += workflows.length;
            this.logger.debug(`Indexed ${processedCount} workflows so far`);
            if (workflows.length < batchSize) {
                break;
            }
        }
        if (processedCount >= LOOP_LIMIT) {
            const message = `Stopping workflow indexing because we hit the limit of ${LOOP_LIMIT} workflows. There's probably a bug causing an infinite loop.`;
            this.logger.warn(message);
            this.errorReporter.warn(new Error(message));
        }
        this.logger.info(`Finished building workflow dependency index. Processed ${processedCount} workflows.`);
    }
    async updateIndexFor(workflow) {
        const dependencyUpdates = new db_1.WorkflowDependencies(workflow.id, workflow.versionCounter);
        workflow.nodes.forEach((node) => {
            this.addNodeTypeDependencies(node, dependencyUpdates);
            this.addCredentialDependencies(node, dependencyUpdates);
            this.addWorkflowCallDependencies(node, dependencyUpdates);
            this.addWebhookPathDependencies(node, dependencyUpdates);
        });
        let updated;
        try {
            updated = await this.dependencyRepository.updateDependenciesForWorkflow(workflow.id, dependencyUpdates);
        }
        catch (e) {
            const error = (0, n8n_workflow_1.ensureError)(e);
            this.logger.error(`Failed to update workflow dependency index for workflow ${workflow.id}: ${error.message}`);
            this.errorReporter.error(error);
            return;
        }
        this.logger.debug(`Workflow dependency index ${updated ? 'updated' : 'skipped'} for workflow ${workflow.id}`);
    }
    addNodeTypeDependencies(node, dependencyUpdates) {
        dependencyUpdates.add({
            dependencyType: 'nodeType',
            dependencyKey: node.type,
            dependencyInfo: { nodeId: node.id, nodeVersion: node.typeVersion },
        });
    }
    addCredentialDependencies(node, dependencyUpdates) {
        if (!node.credentials) {
            return;
        }
        for (const credentialDetails of Object.values(node.credentials)) {
            const { id } = credentialDetails;
            dependencyUpdates.add({
                dependencyType: 'credentialId',
                dependencyKey: id,
                dependencyInfo: { nodeId: node.id, nodeVersion: node.typeVersion },
            });
        }
    }
    addWorkflowCallDependencies(node, dependencyUpdates) {
        if (node.type !== 'n8n-nodes-base.executeWorkflow') {
            return;
        }
        const calledWorkflowId = this.getCalledWorkflowIdFrom(node);
        if (!calledWorkflowId) {
            return;
        }
        dependencyUpdates.add({
            dependencyType: 'workflowCall',
            dependencyKey: calledWorkflowId,
            dependencyInfo: { nodeId: node.id, nodeVersion: node.typeVersion },
        });
    }
    addWebhookPathDependencies(node, dependencyUpdates) {
        if (node.type !== 'n8n-nodes-base.webhook') {
            return;
        }
        const webhookPath = node.parameters.path;
        dependencyUpdates.add({
            dependencyType: 'webhookPath',
            dependencyKey: webhookPath,
            dependencyInfo: { nodeId: node.id, nodeVersion: node.typeVersion },
        });
    }
    getCalledWorkflowIdFrom(node) {
        if (node.parameters?.['source'] === 'parameter') {
            return undefined;
        }
        if (node.parameters?.['source'] === 'localFile') {
            return undefined;
        }
        if (node.parameters?.['source'] === 'url') {
            return undefined;
        }
        if (typeof node.parameters?.['workflowId'] === 'string') {
            return node.parameters?.['workflowId'];
        }
        if (node.parameters &&
            typeof node.parameters['workflowId'] === 'object' &&
            node.parameters['workflowId'] !== null &&
            'value' in node.parameters['workflowId'] &&
            typeof node.parameters['workflowId']['value'] === 'string') {
            return node.parameters['workflowId']['value'];
        }
        this.errorReporter.warn(`While indexing, could not determine called workflow ID from executeWorkflow node ${node.id}`, { extra: node.parameters });
        return undefined;
    }
};
exports.WorkflowIndexService = WorkflowIndexService;
exports.WorkflowIndexService = WorkflowIndexService = __decorate([
    (0, di_1.Service)(),
    __metadata("design:paramtypes", [db_1.WorkflowDependencyRepository,
        db_1.WorkflowRepository,
        event_service_1.EventService,
        backend_common_1.Logger,
        n8n_core_1.ErrorReporter, Object])
], WorkflowIndexService);
//# sourceMappingURL=workflow-index.service.js.map