import type { StateDatabase } from "../db/index.js";
import {
  createRepairAndBackupService,
  type RepairAndBackupOptions,
  type RepairAndBackupResult,
} from "../services/repair-and-backup.js";

export async function runStartupRepairAndBackup(
  database: StateDatabase,
  options: RepairAndBackupOptions = {}
): Promise<RepairAndBackupResult> {
  const service = createRepairAndBackupService(database);
  return service.runStartupRepair(options);
}
