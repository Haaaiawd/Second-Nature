import type { StateDatabase } from "../db/index.js";
import { type RepairAndBackupOptions, type RepairAndBackupResult } from "../services/repair-and-backup.js";
export declare function runStartupRepairAndBackup(database: StateDatabase, options?: RepairAndBackupOptions): Promise<RepairAndBackupResult>;
