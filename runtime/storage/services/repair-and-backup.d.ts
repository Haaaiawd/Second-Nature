import type { StateDatabase } from "../db/index.js";
export interface RepairAndBackupOptions {
    now?: Date;
    staleProposalDays?: number;
    backupDir?: string;
}
export interface RepairAndBackupResult {
    scannedAssetCount: number;
    repairedOrphanIndexCount: number;
    updatedHashCount: number;
    staleProposalCount: number;
    backupPath: string;
    repairedOrphanAssetIds: string[];
    updatedHashAssetIds: string[];
    staleProposalIds: string[];
}
export declare class RepairAndBackupService {
    private readonly database;
    constructor(database: StateDatabase);
    runStartupRepair(options?: RepairAndBackupOptions): Promise<RepairAndBackupResult>;
}
export declare function createRepairAndBackupService(database: StateDatabase): RepairAndBackupService;
