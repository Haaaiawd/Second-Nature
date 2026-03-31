import { createRepairAndBackupService, } from "../services/repair-and-backup.js";
export async function runStartupRepairAndBackup(database, options = {}) {
    const service = createRepairAndBackupService(database);
    return service.runStartupRepair(options);
}
