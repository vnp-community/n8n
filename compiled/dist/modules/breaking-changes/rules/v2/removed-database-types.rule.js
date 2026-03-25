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
exports.RemovedDatabaseTypesRule = void 0;
const config_1 = require("@n8n/config");
const di_1 = require("@n8n/di");
let RemovedDatabaseTypesRule = class RemovedDatabaseTypesRule {
    constructor(globalConfig) {
        this.globalConfig = globalConfig;
        this.id = 'removed-database-types-v2';
    }
    getMetadata() {
        return {
            version: 'v2',
            title: 'MySQL/MariaDB database types removed',
            description: 'MySQL and MariaDB database types have been completely removed and will cause n8n to fail on startup',
            category: "database",
            severity: 'critical',
            documentationUrl: 'https://docs.n8n.io/2-0-breaking-changes/#drop-mysqlmariadb-support',
        };
    }
    async detect() {
        const result = {
            isAffected: false,
            instanceIssues: [],
            recommendations: [],
        };
        const dbType = this.globalConfig.database.type;
        if (dbType === 'mysqldb' || dbType === 'mariadb') {
            result.isAffected = true;
            result.instanceIssues.push({
                title: `${dbType === 'mysqldb' ? 'MySQL' : 'MariaDB'} database type removed`,
                description: 'MySQL and MariaDB database types have been completely removed in v2. n8n will fail to start with this database configuration.',
                level: 'error',
            });
            result.recommendations.push({
                action: 'Migrate to PostgreSQL or SQLite before upgrading',
                description: 'You must migrate your database to PostgreSQL or SQLite before upgrading to v2. Use the database migration tool if available, or export/import your workflows and credentials.',
            });
        }
        return result;
    }
};
exports.RemovedDatabaseTypesRule = RemovedDatabaseTypesRule;
exports.RemovedDatabaseTypesRule = RemovedDatabaseTypesRule = __decorate([
    (0, di_1.Service)(),
    __metadata("design:paramtypes", [config_1.GlobalConfig])
], RemovedDatabaseTypesRule);
//# sourceMappingURL=removed-database-types.rule.js.map