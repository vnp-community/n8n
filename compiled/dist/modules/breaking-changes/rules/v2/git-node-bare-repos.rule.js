"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitNodeBareReposRule = void 0;
const di_1 = require("@n8n/di");
let GitNodeBareReposRule = class GitNodeBareReposRule {
    constructor() {
        this.id = 'git-node-bare-repos-v2';
    }
    getMetadata() {
        return {
            version: 'v2',
            title: 'Git node bare repositories disabled by default',
            description: 'N8N_GIT_NODE_DISABLE_BARE_REPOS now defaults to true for security. Bare repositories are disabled to prevent RCE attacks via Git hooks',
            category: "workflow",
            severity: 'medium',
            documentationUrl: 'https://docs.n8n.io/2-0-breaking-changes/#change-the-default-value-of-n8n_git_node_disable_bare_repos-to-true',
        };
    }
    async getRecommendations(_workflowResults) {
        return [
            {
                action: 'Review Git node usage',
                description: 'Check if any Git nodes in your workflows use bare repositories. Bare repositories are now disabled by default for security reasons.',
            },
            {
                action: 'Migrate away from bare repositories',
                description: 'If possible, update your workflows to use regular Git repositories instead of bare repositories.',
            },
            {
                action: 'Enable bare repositories if required (not recommended)',
                description: 'If you absolutely need bare repository support and understand the security risks, set N8N_GIT_NODE_DISABLE_BARE_REPOS=false. This is not recommended as it exposes your instance to potential RCE attacks via Git hooks.',
            },
        ];
    }
    async detectWorkflow(_workflow, nodesGroupedByType) {
        const disableBareRepos = process.env.N8N_GIT_NODE_DISABLE_BARE_REPOS;
        if (disableBareRepos === 'false') {
            return { isAffected: false, issues: [] };
        }
        const gitNodes = nodesGroupedByType.get('n8n-nodes-base.git') ?? [];
        if (gitNodes.length === 0) {
            return { isAffected: false, issues: [] };
        }
        return {
            isAffected: true,
            issues: gitNodes.map((node) => ({
                title: `Git node '${node.name}' may be affected by bare repository restrictions`,
                description: 'This workflow contains a Git node. Bare repositories are now disabled by default for security reasons. If this node uses bare repositories, it may fail. Review your Git node configuration and migrate to regular repositories if needed, or set N8N_GIT_NODE_DISABLE_BARE_REPOS=false (not recommended) to re-enable bare repository support.',
                level: 'warning',
                nodeId: node.id,
                nodeName: node.name,
            })),
        };
    }
};
exports.GitNodeBareReposRule = GitNodeBareReposRule;
exports.GitNodeBareReposRule = GitNodeBareReposRule = __decorate([
    (0, di_1.Service)()
], GitNodeBareReposRule);
//# sourceMappingURL=git-node-bare-repos.rule.js.map