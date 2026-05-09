import type { StateDatabase } from "../db/index.js";
import { createRepairAndBackupService, type RepairAndBackupOptions } from "../services/repair-and-backup.js";
export interface RepairStateIndexesOptions {
    startupGate?: boolean;
    workspaceRoot: string;
    /** When true, also runs asset registry repair + backup (existing repair service) */
    reconcileAssets?: boolean;
    assetRepairOptions?: RepairAndBackupOptions;
}
export type RepairGateStatus = "ok" | "repair_required";
export interface RepairSummary {
    status: RepairGateStatus;
    repairedEvidenceIndexRows: number;
    repairNotes: string[];
    assetRepair?: Awaited<ReturnType<ReturnType<typeof createRepairAndBackupService>["runStartupRepair"]>>;
}
export declare function repairStateIndexes(state: StateDatabase, options: RepairStateIndexesOptions): Promise<RepairSummary>;
