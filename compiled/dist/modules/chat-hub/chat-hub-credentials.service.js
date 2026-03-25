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
exports.ChatHubCredentialsService = void 0;
const api_types_1 = require("@n8n/api-types");
const db_1 = require("@n8n/db");
const db_2 = require("@n8n/db");
const di_1 = require("@n8n/di");
const credentials_service_1 = require("../../credentials/credentials.service");
const bad_request_error_1 = require("../../errors/response-errors/bad-request.error");
const forbidden_error_1 = require("../../errors/response-errors/forbidden.error");
let ChatHubCredentialsService = class ChatHubCredentialsService {
    constructor(credentialsService, projectRepository, sharedWorkflowRepository) {
        this.credentialsService = credentialsService;
        this.projectRepository = projectRepository;
        this.sharedWorkflowRepository = sharedWorkflowRepository;
    }
    async ensureCredentials(user, provider, credentials, trx) {
        const credentialId = this.pickCredentialId(provider, credentials);
        if (!credentialId) {
            throw new bad_request_error_1.BadRequestError('No credentials provided for the selected model provider');
        }
        return await this.ensureCredentialById(user, credentialId, trx);
    }
    async ensureCredentialById(user, credentialId, trx) {
        const project = await this.projectRepository.getPersonalProjectForUser(user.id, trx);
        if (!project) {
            throw new forbidden_error_1.ForbiddenError('Missing personal project');
        }
        const allCredentials = await this.credentialsService.getCredentialsAUserCanUseInAWorkflow(user, {
            projectId: project.id,
        });
        const credential = allCredentials.find((c) => c.id === credentialId);
        if (!credential) {
            throw new forbidden_error_1.ForbiddenError("You don't have access to the provided credentials");
        }
        return {
            id: credential.id,
            projectId: project.id,
        };
    }
    pickCredentialId(provider, credentials) {
        if (provider === 'n8n' || provider === 'custom-agent') {
            return null;
        }
        return credentials[api_types_1.PROVIDER_CREDENTIAL_TYPE_MAP[provider]]?.id ?? null;
    }
    async ensureWorkflowCredentials(provider, credentials, workflowId) {
        const credentialId = this.pickCredentialId(provider, credentials);
        if (!credentialId) {
            throw new bad_request_error_1.BadRequestError('No credentials provided for the selected model provider');
        }
        const project = await this.sharedWorkflowRepository.getWorkflowOwningProject(workflowId);
        if (!project) {
            throw new forbidden_error_1.ForbiddenError('Missing owner project for the workflow');
        }
        const allCredentials = await this.credentialsService.findAllCredentialIdsForWorkflow(workflowId);
        const credential = allCredentials.find((c) => c.id === credentialId);
        if (!credential) {
            throw new forbidden_error_1.ForbiddenError("You don't have access to the provided credentials");
        }
        return {
            id: credential.id,
            projectId: project.id,
        };
    }
};
exports.ChatHubCredentialsService = ChatHubCredentialsService;
exports.ChatHubCredentialsService = ChatHubCredentialsService = __decorate([
    (0, di_1.Service)(),
    __metadata("design:paramtypes", [credentials_service_1.CredentialsService,
        db_1.ProjectRepository,
        db_2.SharedWorkflowRepository])
], ChatHubCredentialsService);
//# sourceMappingURL=chat-hub-credentials.service.js.map