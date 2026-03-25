import { GlobalConfig } from '@n8n/config';
export declare class DataTableFileCleanupService {
    private readonly globalConfig;
    private readonly uploadDir;
    private cleanupInterval?;
    constructor(globalConfig: GlobalConfig);
    private isErrnoException;
    start(): Promise<void>;
    shutdown(): Promise<void>;
    private cleanupOrphanedFiles;
    deleteFile(fileId: string): Promise<void>;
}
