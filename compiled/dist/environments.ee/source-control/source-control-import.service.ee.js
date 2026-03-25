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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourceControlImportService = void 0;
const backend_common_1 = require("@n8n/backend-common");
const db_1 = require("@n8n/db");
const di_1 = require("@n8n/di");
const permissions_1 = require("@n8n/permissions");
const typeorm_1 = require("@n8n/typeorm");
const fast_glob_1 = __importDefault(require("fast-glob"));
const isEqual_1 = __importDefault(require("lodash/isEqual"));
const n8n_core_1 = require("n8n-core");
const n8n_workflow_1 = require("n8n-workflow");
const promises_1 = require("node:fs/promises");
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const active_workflow_manager_1 = require("../../active-workflow-manager");
const credentials_service_1 = require("../../credentials/credentials.service");
const response_helper_1 = require("../../response-helper");
const tag_service_1 = require("../../services/tag.service");
const utils_1 = require("../../utils");
const workflow_history_service_1 = require("../../workflows/workflow-history/workflow-history.service");
const workflow_service_1 = require("../../workflows/workflow.service");
const constants_1 = require("./constants");
const source_control_helper_ee_1 = require("./source-control-helper.ee");
const source_control_scoped_service_1 = require("./source-control-scoped.service");
const variables_service_ee_1 = require("../variables/variables.service.ee");
const findOwnerProject = (owner, accessibleProjects) => {
    if (typeof owner === 'string') {
        return accessibleProjects.find((project) => project.projectRelations.some((r) => r.role.slug === permissions_1.PROJECT_OWNER_ROLE_SLUG && r.user.email === owner));
    }
    if (owner.type === 'personal') {
        return accessibleProjects.find((project) => project.type === 'personal' &&
            project.projectRelations.some((r) => r.role.slug === permissions_1.PROJECT_OWNER_ROLE_SLUG && r.user.email === owner.personalEmail));
    }
    return accessibleProjects.find((project) => project.type === 'team' && project.id === owner.teamId);
};
const getOwnerFromProject = (remoteOwnerProject) => {
    let owner = undefined;
    if (remoteOwnerProject?.type === 'personal') {
        const personalEmail = remoteOwnerProject.projectRelations?.find((r) => r.role.slug === permissions_1.PROJECT_OWNER_ROLE_SLUG)?.user?.email;
        if (personalEmail) {
            owner = {
                type: 'personal',
                projectId: remoteOwnerProject.id,
                projectName: remoteOwnerProject.name,
            };
        }
    }
    else if (remoteOwnerProject?.type === 'team') {
        owner = {
            type: 'team',
            projectId: remoteOwnerProject.id,
            projectName: remoteOwnerProject.name,
        };
    }
    return owner;
};
let SourceControlImportService = class SourceControlImportService {
    constructor(logger, errorReporter, variablesService, activeWorkflowManager, credentialsRepository, projectRepository, tagRepository, sharedWorkflowRepository, sharedCredentialsRepository, userRepository, variablesRepository, workflowRepository, workflowTagMappingRepository, workflowService, credentialsService, tagService, folderRepository, instanceSettings, sourceControlScopedService, workflowPublishHistoryRepository, workflowHistoryService) {
        this.logger = logger;
        this.errorReporter = errorReporter;
        this.variablesService = variablesService;
        this.activeWorkflowManager = activeWorkflowManager;
        this.credentialsRepository = credentialsRepository;
        this.projectRepository = projectRepository;
        this.tagRepository = tagRepository;
        this.sharedWorkflowRepository = sharedWorkflowRepository;
        this.sharedCredentialsRepository = sharedCredentialsRepository;
        this.userRepository = userRepository;
        this.variablesRepository = variablesRepository;
        this.workflowRepository = workflowRepository;
        this.workflowTagMappingRepository = workflowTagMappingRepository;
        this.workflowService = workflowService;
        this.credentialsService = credentialsService;
        this.tagService = tagService;
        this.folderRepository = folderRepository;
        this.sourceControlScopedService = sourceControlScopedService;
        this.workflowPublishHistoryRepository = workflowPublishHistoryRepository;
        this.workflowHistoryService = workflowHistoryService;
        this.gitFolder = path_1.default.join(instanceSettings.n8nFolder, constants_1.SOURCE_CONTROL_GIT_FOLDER);
        this.workflowExportFolder = path_1.default.join(this.gitFolder, constants_1.SOURCE_CONTROL_WORKFLOW_EXPORT_FOLDER);
        this.credentialExportFolder = path_1.default.join(this.gitFolder, constants_1.SOURCE_CONTROL_CREDENTIAL_EXPORT_FOLDER);
        this.projectExportFolder = path_1.default.join(this.gitFolder, constants_1.SOURCE_CONTROL_PROJECT_EXPORT_FOLDER);
    }
    async getRemoteVersionIdsFromFiles(context) {
        const remoteWorkflowFiles = await (0, fast_glob_1.default)('*.json', {
            cwd: this.workflowExportFolder,
            absolute: true,
        });
        const accessibleProjects = await this.sourceControlScopedService.getAuthorizedProjectsFromContext(context);
        const remoteWorkflowsRead = await Promise.all(remoteWorkflowFiles.map(async (file) => await this.parseWorkflowFromFile(file)));
        const remoteWorkflowFilesParsed = remoteWorkflowsRead
            .filter((remote) => {
            if (!remote?.id) {
                return false;
            }
            return (context.hasAccessToAllProjects() ||
                (remote.owner && findOwnerProject(remote.owner, accessibleProjects)));
        })
            .map((remote) => {
            const project = remote.owner
                ? findOwnerProject(remote.owner, accessibleProjects)
                : undefined;
            return {
                id: remote.id,
                versionId: remote.versionId ?? '',
                name: remote.name,
                parentFolderId: remote.parentFolderId,
                remoteId: remote.id,
                filename: (0, source_control_helper_ee_1.getWorkflowExportPath)(remote.id, this.workflowExportFolder),
                owner: project ? getOwnerFromProject(project) : undefined,
            };
        });
        return remoteWorkflowFilesParsed;
    }
    async getAllLocalVersionIdsFromDb() {
        const localWorkflows = await this.workflowRepository.find({
            relations: ['parentFolder'],
            select: {
                id: true,
                versionId: true,
                name: true,
                updatedAt: true,
                parentFolder: {
                    id: true,
                },
            },
        });
        return localWorkflows.map((local) => {
            let updatedAt;
            if (local.updatedAt instanceof Date) {
                updatedAt = local.updatedAt;
            }
            else {
                this.errorReporter.warn('updatedAt is not a Date', {
                    extra: {
                        type: typeof local.updatedAt,
                        value: local.updatedAt,
                    },
                });
                updatedAt = isNaN(Date.parse(local.updatedAt)) ? new Date() : new Date(local.updatedAt);
            }
            return {
                id: local.id,
                versionId: local.versionId,
                name: local.name,
                localId: local.id,
                parentFolderId: local.parentFolder?.id ?? null,
                filename: (0, source_control_helper_ee_1.getWorkflowExportPath)(local.id, this.workflowExportFolder),
                updatedAt: updatedAt.toISOString(),
            };
        });
    }
    async getLocalVersionIdsFromDb(context) {
        const localWorkflows = await this.workflowRepository.find({
            relations: {
                parentFolder: true,
                shared: {
                    project: {
                        projectRelations: {
                            user: true,
                            role: true,
                        },
                    },
                },
            },
            select: {
                id: true,
                versionId: true,
                name: true,
                updatedAt: true,
                parentFolder: {
                    id: true,
                },
                shared: {
                    project: {
                        id: true,
                        name: true,
                        type: true,
                        projectRelations: {
                            userId: true,
                            role: {
                                slug: true,
                            },
                            user: {
                                email: true,
                            },
                        },
                    },
                    role: true,
                },
            },
            where: this.sourceControlScopedService.getWorkflowsInAdminProjectsFromContextFilter(context),
        });
        return localWorkflows.map((local) => {
            let updatedAt;
            if (local.updatedAt instanceof Date) {
                updatedAt = local.updatedAt;
            }
            else {
                this.errorReporter.warn('updatedAt is not a Date', {
                    extra: {
                        type: typeof local.updatedAt,
                        value: local.updatedAt,
                    },
                });
                updatedAt = isNaN(Date.parse(local.updatedAt)) ? new Date() : new Date(local.updatedAt);
            }
            const remoteOwnerProject = local.shared?.find((s) => s.role === 'workflow:owner')?.project;
            return {
                id: local.id,
                versionId: local.versionId,
                name: local.name,
                localId: local.id,
                parentFolderId: local.parentFolder?.id ?? null,
                filename: (0, source_control_helper_ee_1.getWorkflowExportPath)(local.id, this.workflowExportFolder),
                updatedAt: updatedAt.toISOString(),
                owner: remoteOwnerProject ? getOwnerFromProject(remoteOwnerProject) : undefined,
            };
        });
    }
    async getRemoteCredentialsFromFiles(context) {
        const remoteCredentialFiles = await (0, fast_glob_1.default)('*.json', {
            cwd: this.credentialExportFolder,
            absolute: true,
        });
        const accessibleProjects = await this.sourceControlScopedService.getAuthorizedProjectsFromContext(context);
        const remoteCredentialFilesRead = await Promise.all(remoteCredentialFiles.map(async (file) => {
            this.logger.debug(`Parsing credential file ${file}`);
            const remote = (0, n8n_workflow_1.jsonParse)(await (0, promises_1.readFile)(file, { encoding: 'utf8' }));
            return remote;
        }));
        const remoteCredentialFilesParsed = remoteCredentialFilesRead
            .filter((remote) => {
            if (!remote?.id) {
                return false;
            }
            const owner = remote.ownedBy;
            return (!owner || context.hasAccessToAllProjects() || findOwnerProject(owner, accessibleProjects));
        })
            .map((remote) => {
            const project = remote.ownedBy
                ? findOwnerProject(remote.ownedBy, accessibleProjects)
                : null;
            return {
                ...remote,
                ownedBy: project
                    ? {
                        type: project.type,
                        projectId: project.id,
                        projectName: project.name,
                    }
                    : undefined,
                filename: (0, source_control_helper_ee_1.getCredentialExportPath)(remote.id, this.credentialExportFolder),
            };
        });
        return remoteCredentialFilesParsed.filter((e) => e !== undefined);
    }
    async getLocalCredentialsFromDb(context) {
        const localCredentials = await this.credentialsRepository.find({
            relations: {
                shared: {
                    project: {
                        projectRelations: {
                            user: true,
                            role: true,
                        },
                    },
                },
            },
            select: {
                id: true,
                name: true,
                type: true,
                isGlobal: true,
                shared: {
                    project: {
                        id: true,
                        name: true,
                        type: true,
                        projectRelations: {
                            userId: true,
                            role: {
                                slug: true,
                            },
                            user: {
                                email: true,
                            },
                        },
                    },
                    role: true,
                },
            },
            where: this.sourceControlScopedService.getCredentialsInAdminProjectsFromContextFilter(context),
        });
        return localCredentials.map((local) => {
            const remoteOwnerProject = local.shared?.find((s) => s.role === 'credential:owner')?.project;
            return {
                id: local.id,
                name: local.name,
                type: local.type,
                filename: (0, source_control_helper_ee_1.getCredentialExportPath)(local.id, this.credentialExportFolder),
                ownedBy: remoteOwnerProject ? getOwnerFromProject(remoteOwnerProject) : undefined,
                isGlobal: local.isGlobal,
            };
        });
    }
    async getRemoteVariablesFromFile() {
        const variablesFile = await (0, fast_glob_1.default)(constants_1.SOURCE_CONTROL_VARIABLES_EXPORT_FILE, {
            cwd: this.gitFolder,
            absolute: true,
        });
        if (variablesFile.length > 0) {
            this.logger.debug(`Importing variables from file ${variablesFile[0]}`);
            return (0, n8n_workflow_1.jsonParse)(await (0, promises_1.readFile)(variablesFile[0], { encoding: 'utf8' }), {
                fallbackValue: [],
            });
        }
        return [];
    }
    async getLocalGlobalVariablesFromDb() {
        return await this.variablesService.getAllCached({ globalOnly: true });
    }
    async getRemoteFoldersAndMappingsFromFile(context) {
        const foldersFile = await (0, fast_glob_1.default)(constants_1.SOURCE_CONTROL_FOLDERS_EXPORT_FILE, {
            cwd: this.gitFolder,
            absolute: true,
        });
        if (foldersFile.length > 0) {
            this.logger.debug(`Importing folders from file ${foldersFile[0]}`);
            const mappedFolders = (0, n8n_workflow_1.jsonParse)(await (0, promises_1.readFile)(foldersFile[0], { encoding: 'utf8' }), {
                fallbackValue: { folders: [] },
            });
            const accessibleProjects = await this.sourceControlScopedService.getAuthorizedProjectsFromContext(context);
            mappedFolders.folders = mappedFolders.folders.filter((folder) => context.hasAccessToAllProjects() ||
                accessibleProjects.some((project) => project.id === folder.homeProjectId));
            return mappedFolders;
        }
        return { folders: [] };
    }
    async getLocalFoldersAndMappingsFromDb(context) {
        const localFolders = await this.folderRepository.find({
            relations: ['parentFolder', 'homeProject'],
            select: {
                id: true,
                name: true,
                createdAt: true,
                updatedAt: true,
                parentFolder: { id: true },
                homeProject: { id: true },
            },
            where: this.sourceControlScopedService.getFoldersInAdminProjectsFromContextFilter(context),
        });
        return {
            folders: localFolders.map((f) => ({
                id: f.id,
                name: f.name,
                parentFolderId: f.parentFolder?.id ?? null,
                homeProjectId: f.homeProject.id,
                createdAt: f.createdAt.toISOString(),
                updatedAt: f.updatedAt.toISOString(),
            })),
        };
    }
    async getRemoteTagsAndMappingsFromFile(context) {
        const tagsFile = await (0, fast_glob_1.default)(constants_1.SOURCE_CONTROL_TAGS_EXPORT_FILE, {
            cwd: this.gitFolder,
            absolute: true,
        });
        if (tagsFile.length > 0) {
            this.logger.debug(`Importing tags from file ${tagsFile[0]}`);
            const mappedTags = (0, n8n_workflow_1.jsonParse)(await (0, promises_1.readFile)(tagsFile[0], { encoding: 'utf8' }), { fallbackValue: { tags: [], mappings: [] } });
            const accessibleWorkflows = await this.sourceControlScopedService.getWorkflowsInAdminProjectsFromContext(context);
            if (accessibleWorkflows) {
                mappedTags.mappings = mappedTags.mappings.filter((mapping) => accessibleWorkflows.some((workflow) => workflow.id === mapping.workflowId));
            }
            return mappedTags;
        }
        return { tags: [], mappings: [] };
    }
    async getLocalTagsAndMappingsFromDb(context) {
        const localTags = await this.tagRepository.find({
            select: ['id', 'name'],
        });
        const localMappings = await this.workflowTagMappingRepository.find({
            select: ['workflowId', 'tagId'],
            where: this.sourceControlScopedService.getWorkflowTagMappingInAdminProjectsFromContextFilter(context),
        });
        return { tags: localTags, mappings: localMappings };
    }
    async getRemoteProjectsFromFiles(context) {
        const remoteProjectFiles = await (0, fast_glob_1.default)('*.json', {
            cwd: this.projectExportFolder,
            absolute: true,
        });
        const remoteProjects = await Promise.all(remoteProjectFiles.map(async (file) => {
            this.logger.debug(`Parsing project file ${file}`);
            const fileContent = await (0, promises_1.readFile)(file, { encoding: 'utf8' });
            const parsedProject = (0, n8n_workflow_1.jsonParse)(fileContent);
            return {
                ...parsedProject,
                filename: (0, source_control_helper_ee_1.getProjectExportPath)(parsedProject.id, this.projectExportFolder),
            };
        }));
        if (context.hasAccessToAllProjects()) {
            return remoteProjects;
        }
        const accessibleProjects = await this.sourceControlScopedService.getAuthorizedProjectsFromContext(context);
        return remoteProjects.filter((remoteProject) => {
            return findOwnerProject(remoteProject.owner, accessibleProjects);
        });
    }
    async getLocalTeamProjectsFromDb(context) {
        let where = { type: 'team' };
        if (context) {
            where = {
                type: 'team',
                ...(this.sourceControlScopedService.getProjectsWithPushScopeByContextFilter(context) ?? {}),
            };
        }
        const localProjects = await this.projectRepository.find({
            select: ['id', 'name', 'description', 'icon', 'type'],
            relations: ['variables'],
            where,
        });
        return localProjects.map((local) => this.mapProjectEntityToExportableProjectWithFileName(local));
    }
    mapProjectEntityToExportableProjectWithFileName(project) {
        return {
            id: project.id,
            name: project.name,
            description: project.description,
            icon: project.icon,
            filename: (0, source_control_helper_ee_1.getProjectExportPath)(project.id, this.projectExportFolder),
            type: 'team',
            owner: {
                type: 'team',
                teamId: project.id,
                teamName: project.name,
            },
            variableStubs: project.variables.map((variable) => ({
                id: variable.id,
                key: variable.key,
                type: variable.type,
                value: '',
            })),
        };
    }
    async importWorkflowFromWorkFolder(candidates, userId) {
        const personalProject = await this.projectRepository.getPersonalProjectForUserOrFail(userId);
        const candidateIds = candidates.map((c) => c.id);
        const existingWorkflows = await this.workflowRepository.findByIds(candidateIds, {
            fields: ['id', 'name', 'versionId', 'active', 'activeVersionId'],
        });
        const folders = await this.folderRepository.find({ select: ['id'] });
        const existingFolderIds = folders.map((f) => f.id);
        const allSharedWorkflows = await this.sharedWorkflowRepository.findWithFields(candidateIds, {
            select: ['workflowId', 'role', 'projectId'],
        });
        const importWorkflowsResult = [];
        for (const candidate of candidates) {
            this.logger.debug(`Parsing workflow file ${candidate.file}`);
            const importedWorkflow = await this.parseWorkflowFromFile(candidate.file);
            if (!importedWorkflow?.id) {
                continue;
            }
            const existingWorkflow = existingWorkflows.find((e) => e.id === importedWorkflow.id);
            if (existingWorkflow) {
                if (importedWorkflow.isArchived) {
                    importedWorkflow.active = false;
                    importedWorkflow.activeVersionId = null;
                }
                else {
                    importedWorkflow.active = !!existingWorkflow.activeVersionId;
                    importedWorkflow.activeVersionId = existingWorkflow.activeVersionId;
                }
            }
            else {
                importedWorkflow.active = false;
                importedWorkflow.activeVersionId = null;
                importedWorkflow.versionId = importedWorkflow.versionId ?? (0, uuid_1.v4)();
            }
            const parentFolderId = importedWorkflow.parentFolderId ?? '';
            this.logger.debug(`Updating workflow id ${importedWorkflow.id ?? 'new'}`);
            const upsertResult = await this.workflowRepository.upsert({
                ...importedWorkflow,
                parentFolder: existingFolderIds.includes(parentFolderId) ? { id: parentFolderId } : null,
            }, ['id']);
            if (upsertResult?.identifiers?.length !== 1) {
                throw new n8n_workflow_1.UnexpectedError('Failed to upsert workflow', {
                    extra: { workflowId: importedWorkflow.id ?? 'new' },
                });
            }
            await this.saveOrUpdateWorkflowHistory(importedWorkflow, userId);
            const localOwner = allSharedWorkflows.find((w) => w.workflowId === importedWorkflow.id && w.role === 'workflow:owner');
            await this.syncResourceOwnership({
                resourceId: importedWorkflow.id,
                remoteOwner: importedWorkflow.owner,
                localOwner,
                fallbackProject: personalProject,
                repository: this.sharedWorkflowRepository,
            });
            await this.activateImportedWorkflowIfAlreadyActive({ existingWorkflow, importedWorkflow }, userId);
            importWorkflowsResult.push({
                id: importedWorkflow.id ?? 'unknown',
                name: candidate.file,
            });
        }
        return importWorkflowsResult.filter((e) => e !== undefined);
    }
    async parseWorkflowFromFile(file) {
        this.logger.debug(`Parsing workflow file ${file}`);
        try {
            const fileContent = await (0, promises_1.readFile)(file, { encoding: 'utf8' });
            return (0, n8n_workflow_1.jsonParse)(fileContent);
        }
        catch (error) {
            this.logger.error(`Failed to parse workflow file ${file}`, { error });
            throw new n8n_workflow_1.UnexpectedError(`Failed to parse workflow file ${file}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async activateImportedWorkflowIfAlreadyActive({ existingWorkflow, importedWorkflow, }, userId) {
        if (!existingWorkflow?.activeVersionId)
            return;
        let didAdd = false;
        try {
            this.logger.debug(`Deactivating workflow id ${existingWorkflow.id}`);
            await this.activeWorkflowManager.remove(existingWorkflow.id);
            if (importedWorkflow.activeVersionId) {
                this.logger.debug(`Reactivating workflow id ${existingWorkflow.id}`);
                await this.activeWorkflowManager.add(existingWorkflow.id, 'activate');
                didAdd = true;
            }
        }
        catch (e) {
            const error = (0, n8n_workflow_1.ensureError)(e);
            this.logger.error(`Failed to activate workflow ${existingWorkflow.id}`, { error });
        }
        finally {
            await this.workflowRepository.update({ id: existingWorkflow.id }, { versionId: importedWorkflow.versionId });
            if (didAdd) {
                await this.workflowPublishHistoryRepository.addRecord({
                    workflowId: existingWorkflow.id,
                    versionId: existingWorkflow.activeVersionId,
                    event: 'activated',
                    userId,
                });
            }
            else {
                await this.workflowPublishHistoryRepository.addRecord({
                    workflowId: existingWorkflow.id,
                    versionId: existingWorkflow.activeVersionId,
                    event: 'deactivated',
                    userId,
                });
            }
        }
    }
    async importCredentialsFromWorkFolder(candidates, userId) {
        const personalProject = await this.projectRepository.getPersonalProjectForUserOrFail(userId);
        const candidateIds = candidates.map((c) => c.id);
        const existingCredentials = await this.credentialsRepository.find({
            where: {
                id: (0, typeorm_1.In)(candidateIds),
            },
            select: ['id', 'name', 'type', 'data'],
        });
        const existingSharedCredentials = await this.sharedCredentialsRepository.find({
            select: ['credentialsId', 'projectId', 'role'],
            where: {
                credentialsId: (0, typeorm_1.In)(candidateIds),
                role: 'credential:owner',
            },
        });
        let importCredentialsResult = [];
        importCredentialsResult = await Promise.all(candidates.map(async (candidate) => {
            this.logger.debug(`Importing credentials file ${candidate.file}`);
            const credential = (0, n8n_workflow_1.jsonParse)(await (0, promises_1.readFile)(candidate.file, { encoding: 'utf8' }));
            const existingCredential = existingCredentials.find((e) => e.id === credential.id && e.type === credential.type);
            const { name, type, data, id, isGlobal = false } = credential;
            const newCredentialObject = new n8n_core_1.Credentials({ id, name }, type);
            if (existingCredential?.data) {
                newCredentialObject.data = existingCredential.data;
            }
            else {
                const { oauthTokenData, ...rest } = data;
                newCredentialObject.setData(rest);
            }
            this.logger.debug(`Updating credential id ${newCredentialObject.id}`);
            await this.credentialsRepository.upsert({ ...newCredentialObject, isGlobal }, ['id']);
            const localOwner = existingSharedCredentials.find((c) => c.credentialsId === credential.id && c.role === 'credential:owner');
            await this.syncResourceOwnership({
                resourceId: credential.id,
                remoteOwner: credential.ownedBy,
                localOwner,
                fallbackProject: personalProject,
                repository: this.sharedCredentialsRepository,
            });
            return {
                id: newCredentialObject.id,
                name: newCredentialObject.name,
                type: newCredentialObject.type,
            };
        }));
        return importCredentialsResult.filter((e) => e !== undefined);
    }
    async importTagsFromWorkFolder(candidate) {
        let mappedTags;
        try {
            this.logger.debug(`Importing tags from file ${candidate.file}`);
            mappedTags = (0, n8n_workflow_1.jsonParse)(await (0, promises_1.readFile)(candidate.file, { encoding: 'utf8' }), { fallbackValue: { tags: [], mappings: [] } });
        }
        catch (e) {
            const error = (0, n8n_workflow_1.ensureError)(e);
            this.logger.error(`Failed to import tags from file ${candidate.file}`, { error });
            return;
        }
        if (mappedTags.mappings.length === 0 && mappedTags.tags.length === 0) {
            return;
        }
        const existingWorkflowIds = new Set((await this.workflowRepository.find({
            select: ['id'],
        })).map((e) => e.id));
        await Promise.all(mappedTags.tags.map(async (tag) => {
            const findByName = await this.tagRepository.findOne({
                where: { name: tag.name },
                select: ['id'],
            });
            if (findByName && findByName.id !== tag.id) {
                throw new n8n_workflow_1.UserError(`A tag with the name <strong>${tag.name}</strong> already exists locally.<br />Please either rename the local tag, or the remote one with the id <strong>${tag.id}</strong> in the tags.json file.`);
            }
            const tagCopy = this.tagRepository.create(tag);
            await this.tagRepository.upsert(tagCopy, {
                skipUpdateIfNoValuesChanged: true,
                conflictPaths: { id: true },
            });
        }));
        await Promise.all(mappedTags.mappings.map(async (mapping) => {
            if (!existingWorkflowIds.has(String(mapping.workflowId)))
                return;
            await this.workflowTagMappingRepository.upsert({ tagId: String(mapping.tagId), workflowId: String(mapping.workflowId) }, {
                skipUpdateIfNoValuesChanged: true,
                conflictPaths: { tagId: true, workflowId: true },
            });
        }));
        return mappedTags;
    }
    async importFoldersFromWorkFolder(user, candidate) {
        let mappedFolders;
        const projects = await this.projectRepository.find();
        const personalProject = await this.projectRepository.getPersonalProjectForUserOrFail(user.id);
        try {
            this.logger.debug(`Importing folders from file ${candidate.file}`);
            mappedFolders = (0, n8n_workflow_1.jsonParse)(await (0, promises_1.readFile)(candidate.file, { encoding: 'utf8' }), {
                fallbackValue: { folders: [] },
            });
        }
        catch (e) {
            const error = (0, n8n_workflow_1.ensureError)(e);
            this.logger.error(`Failed to import folders from file ${candidate.file}`, { error });
            return;
        }
        if (mappedFolders.folders.length === 0) {
            return;
        }
        await Promise.all(mappedFolders.folders.map(async (folder) => {
            const folderCopy = this.folderRepository.create({
                id: folder.id,
                name: folder.name,
                homeProject: {
                    id: projects.find((p) => p.id === folder.homeProjectId)?.id ?? personalProject.id,
                },
            });
            await this.folderRepository.upsert(folderCopy, {
                skipUpdateIfNoValuesChanged: true,
                conflictPaths: { id: true },
            });
        }));
        await Promise.all(mappedFolders.folders.map(async (folder) => {
            await this.folderRepository.update({ id: folder.id }, {
                parentFolder: folder.parentFolderId ? { id: folder.parentFolderId } : null,
                createdAt: folder.createdAt,
                updatedAt: folder.updatedAt,
            });
        }));
        return mappedFolders;
    }
    async importVariables(variables, valueOverrides) {
        const result = { imported: [] };
        const overriddenKeys = Object.keys(valueOverrides ?? {});
        for (const variable of variables) {
            if (!variable.key) {
                continue;
            }
            if (overriddenKeys.includes(variable.key) && valueOverrides) {
                variable.value = valueOverrides[variable.key];
                overriddenKeys.splice(overriddenKeys.indexOf(variable.key), 1);
            }
            try {
                const variableToUpsert = {
                    ...variable,
                    value: variable.value === '' ? undefined : variable.value,
                    project: variable.projectId ? { id: variable.projectId } : null,
                };
                await this.variablesRepository.upsert(variableToUpsert, ['id']);
            }
            catch (errorUpsert) {
                if ((0, response_helper_1.isUniqueConstraintError)(errorUpsert)) {
                    this.logger.debug(`Variable ${variable.key} already exists, updating instead`);
                    try {
                        await this.variablesRepository.update({ key: variable.key }, { ...variable });
                    }
                    catch (errorUpdate) {
                        this.logger.debug(`Failed to update variable ${variable.key}, skipping`);
                        this.logger.debug(errorUpdate.message);
                    }
                }
            }
            finally {
                result.imported.push(variable.key);
            }
        }
        if (overriddenKeys.length > 0 && valueOverrides) {
            for (const key of overriddenKeys) {
                result.imported.push(key);
                const newVariable = this.variablesRepository.create({
                    key,
                    value: valueOverrides[key],
                });
                await this.variablesRepository.save(newVariable, { transaction: false });
            }
        }
        await this.variablesService.updateCache();
        return result;
    }
    async importVariablesFromWorkFolder(candidate, valueOverrides) {
        let importedVariables;
        try {
            this.logger.debug(`Importing variables from file ${candidate.file}`);
            importedVariables = (0, n8n_workflow_1.jsonParse)(await (0, promises_1.readFile)(candidate.file, { encoding: 'utf8' }), { fallbackValue: [] });
        }
        catch (e) {
            this.logger.error(`Failed to import tags from file ${candidate.file}`, { error: e });
            return;
        }
        return await this.importVariables(importedVariables, valueOverrides);
    }
    async importTeamProjectsFromWorkFolder(candidates) {
        const importResults = [];
        const existingProjectVariables = (await this.variablesService.getAllCached()).filter((v) => v.project);
        for (const candidate of candidates) {
            try {
                this.logger.debug(`Importing project file ${candidate.file}`);
                const project = (0, n8n_workflow_1.jsonParse)(await (0, promises_1.readFile)(candidate.file, { encoding: 'utf8' }));
                if (typeof project.owner !== 'object' ||
                    project.owner.type !== 'team' ||
                    project.owner.teamId !== project.id) {
                    this.logger.warn(`Project ${project.id} has inconsistent owner data, skipping`);
                    continue;
                }
                await this.projectRepository.upsert({
                    id: project.id,
                    name: project.name,
                    icon: project.icon,
                    description: project.description,
                    type: 'team',
                }, ['id']);
                await this.importVariables(project.variableStubs?.map((v) => ({ ...v, projectId: project.id })) ?? []);
                const deletedVariables = existingProjectVariables.filter((v) => v.project.id === project.id && !project.variableStubs?.some((vs) => vs.id === v.id));
                await this.variablesService.deleteByIds(deletedVariables.map((v) => v.id));
                this.logger.info(`Imported team project: ${project.name}`);
                importResults.push({
                    id: project.id,
                    name: project.name,
                });
            }
            catch (error) {
                const errorMessage = (0, n8n_workflow_1.ensureError)(error);
                this.logger.error(`Failed to import project from file ${candidate.file}`, {
                    error: errorMessage,
                });
            }
        }
        return importResults;
    }
    async deleteWorkflowsNotInWorkfolder(user, candidates) {
        for (const candidate of candidates) {
            await this.workflowService.delete(user, candidate.id, true);
        }
    }
    async deleteCredentialsNotInWorkfolder(user, candidates) {
        for (const candidate of candidates) {
            await this.credentialsService.delete(user, candidate.id);
        }
    }
    async deleteVariablesNotInWorkfolder(candidates) {
        for (const candidate of candidates) {
            await this.variablesService.delete(candidate.id);
        }
    }
    async deleteTagsNotInWorkfolder(candidates) {
        for (const candidate of candidates) {
            await this.tagService.delete(candidate.id);
        }
    }
    async deleteFoldersNotInWorkfolder(candidates) {
        if (candidates.length === 0) {
            return;
        }
        const candidateIds = candidates.map((c) => c.id);
        await this.folderRepository.delete({
            id: (0, typeorm_1.In)(candidateIds),
        });
    }
    async deleteTeamProjectsNotInWorkfolder(candidates) {
        if (candidates.length === 0) {
            return;
        }
        const candidateIds = candidates.map((c) => c.id);
        await this.projectRepository.delete({
            id: (0, typeorm_1.In)(candidateIds),
        });
    }
    async syncResourceOwnership({ resourceId, remoteOwner, localOwner, fallbackProject, repository, }) {
        let targetOwnerProject = await this.findOwnerProjectInLocalDb(remoteOwner ?? undefined);
        if (!targetOwnerProject) {
            const isSharedResource = remoteOwner && typeof remoteOwner !== 'string' && remoteOwner.type === 'team';
            targetOwnerProject = isSharedResource
                ? await this.createTeamProject(remoteOwner)
                : fallbackProject;
        }
        const trx = this.workflowRepository.manager;
        const shouldRemoveOldOwner = localOwner && localOwner.projectId !== targetOwnerProject.id;
        if (shouldRemoveOldOwner) {
            await repository.deleteByIds([resourceId], localOwner.projectId, trx);
        }
        await repository.makeOwner([resourceId], targetOwnerProject.id, trx);
    }
    async findOwnerProjectInLocalDb(owner) {
        if (!owner) {
            return null;
        }
        if (typeof owner === 'string' || owner.type === 'personal') {
            const email = typeof owner === 'string' ? owner : owner.personalEmail;
            const user = await this.userRepository.findOne({ where: { email } });
            if (!user) {
                return null;
            }
            return await this.projectRepository.getPersonalProjectForUserOrFail(user.id);
        }
        else if (owner.type === 'team') {
            return await this.projectRepository.findOne({
                where: { id: owner.teamId },
            });
        }
        (0, utils_1.assertNever)(owner);
        const errorOwner = owner;
        throw new n8n_workflow_1.UnexpectedError(`Unknown resource owner type "${typeof errorOwner !== 'string' ? errorOwner.type : 'UNKNOWN'}" found when finding owner project`);
    }
    async createTeamProject(owner) {
        let teamProject = null;
        try {
            teamProject = await this.projectRepository.save(this.projectRepository.create({
                id: owner.teamId,
                name: owner.teamName,
                type: 'team',
            }));
        }
        catch (error) {
            teamProject = await this.projectRepository.findOne({
                where: { id: owner.teamId },
            });
            if (!teamProject) {
                throw error;
            }
        }
        return teamProject;
    }
    async saveOrUpdateWorkflowHistory(importedWorkflow, userId) {
        if (!importedWorkflow.versionId || !importedWorkflow.nodes || !importedWorkflow.connections) {
            this.logger.debug('Skipping workflow history - missing versionId, nodes, or connections');
            return;
        }
        const user = await this.userRepository.findOne({ where: { id: userId } });
        const authors = user ? `${user.firstName} ${user.lastName}` : 'Unknown';
        try {
            const existingVersion = await this.workflowHistoryService.findVersion(importedWorkflow.id, importedWorkflow.versionId);
            if (existingVersion) {
                const nodesChanged = !(0, isEqual_1.default)(existingVersion.nodes, importedWorkflow.nodes);
                const connectionsChanged = !(0, isEqual_1.default)(existingVersion.connections, importedWorkflow.connections);
                if (nodesChanged || connectionsChanged) {
                    this.logger.debug(`Updating workflow history for versionId ${importedWorkflow.versionId}`);
                    await this.workflowHistoryService.updateVersion(importedWorkflow.versionId, importedWorkflow.id, {
                        nodes: importedWorkflow.nodes,
                        connections: importedWorkflow.connections,
                        authors,
                    });
                }
                else {
                    this.logger.debug(`Workflow history unchanged for versionId ${importedWorkflow.versionId}`);
                }
            }
            else {
                this.logger.debug(`Creating new workflow history for versionId ${importedWorkflow.versionId}`);
                await this.workflowHistoryService.saveVersion(authors, importedWorkflow, importedWorkflow.id);
            }
        }
        catch (error) {
            this.logger.error(`Failed to save/update workflow history for workflow ${importedWorkflow.id}`, { error: (0, n8n_workflow_1.ensureError)(error) });
        }
    }
};
exports.SourceControlImportService = SourceControlImportService;
exports.SourceControlImportService = SourceControlImportService = __decorate([
    (0, di_1.Service)(),
    __metadata("design:paramtypes", [backend_common_1.Logger,
        n8n_core_1.ErrorReporter,
        variables_service_ee_1.VariablesService,
        active_workflow_manager_1.ActiveWorkflowManager,
        db_1.CredentialsRepository,
        db_1.ProjectRepository,
        db_1.TagRepository,
        db_1.SharedWorkflowRepository,
        db_1.SharedCredentialsRepository,
        db_1.UserRepository,
        db_1.VariablesRepository,
        db_1.WorkflowRepository,
        db_1.WorkflowTagMappingRepository,
        workflow_service_1.WorkflowService,
        credentials_service_1.CredentialsService,
        tag_service_1.TagService,
        db_1.FolderRepository,
        n8n_core_1.InstanceSettings,
        source_control_scoped_service_1.SourceControlScopedService,
        db_1.WorkflowPublishHistoryRepository,
        workflow_history_service_1.WorkflowHistoryService])
], SourceControlImportService);
//# sourceMappingURL=source-control-import.service.ee.js.map