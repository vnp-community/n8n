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
exports.SqliteLegacyDriverRule = void 0;
const config_1 = require("@n8n/config");
const di_1 = require("@n8n/di");
let SqliteLegacyDriverRule = class SqliteLegacyDriverRule {
    constructor(globalConfig) {
        this.globalConfig = globalConfig;
        this.id = 'sqlite-legacy-driver-v2';
    }
    getMetadata() {
        return {
            version: 'v2',
            title: 'Remove SQLite legacy driver',
            description: 'SQLite now uses WAL (Write-Ahead Logging) mode exclusively, with additional database files',
            category: "database",
            severity: 'low',
            documentationUrl: 'https://docs.n8n.io/2-0-breaking-changes/#remove-sqlite-legacy-driver',
        };
    }
    async detect() {
        const result = {
            isAffected: false,
            instanceIssues: [],
            recommendations: [],
        };
        const dbType = this.globalConfig.database.type;
        const enableWAL = this.globalConfig.database.sqlite.enableWAL;
        if (dbType === 'sqlite' && !enableWAL) {
            result.isAffected = true;
            result.instanceIssues.push({
                title: 'SQLite legacy driver removed',
                description: 'SQLite now uses WAL (Write-Ahead Logging) mode exclusively. The legacy driver (DB_SQLITE_POOL_SIZE=0) has been removed. Three database files will be created: database.sqlite (main), database.sqlite-wal (write-ahead log), and database.sqlite-shm (shared memory).',
                level: 'warning',
            });
            result.instanceIssues.push({
                title: 'File system compatibility requirements',
                description: 'Incompatible file systems include: NFS versions < 4, CIFS/SMB network shares, read-only file systems, and some container overlay filesystems.',
                level: 'warning',
            });
            result.recommendations.push({
                action: 'Set DB_SQLITE_POOL_SIZE to enable WAL mode',
                description: 'Set DB_SQLITE_POOL_SIZE to a value >= 1 (recommended: 3) to use the modern SQLite driver with WAL mode',
            });
            result.recommendations.push({
                action: 'Update backup procedures',
                description: 'Ensure backups include all three SQLite files (database.sqlite, database.sqlite-wal, database.sqlite-shm) or use the online backup API',
            });
            result.recommendations.push({
                action: 'Verify file system compatibility',
                description: 'Verify Docker volumes and file systems support shared memory operations required by WAL mode',
            });
            result.recommendations.push({
                action: 'Rollback procedure if needed',
                description: 'If rolling back to v1.x, convert back to rollback journal mode using: sqlite3 ~/.n8n/database.sqlite "PRAGMA journal_mode=DELETE;"',
            });
        }
        return result;
    }
};
exports.SqliteLegacyDriverRule = SqliteLegacyDriverRule;
exports.SqliteLegacyDriverRule = SqliteLegacyDriverRule = __decorate([
    (0, di_1.Service)(),
    __metadata("design:paramtypes", [config_1.GlobalConfig])
], SqliteLegacyDriverRule);
//# sourceMappingURL=sqlite-legacy-driver.rule.js.map