import fs from "node:fs/promises";
import path from "node:path";
import { and, eq, inArray, lt } from "drizzle-orm";
import { assetRegistry, proposalRecords } from "../db/schema/index.js";
import { fileExists, hashFile } from "../memory/workspace/paths.js";
const DEFAULT_STALE_DAYS = 7;
const DEFAULT_BACKUP_DIR = "./workspace/backups";
export class RepairAndBackupService {
    database;
    constructor(database) {
        this.database = database;
    }
    async runStartupRepair(options = {}) {
        const now = options.now ?? new Date();
        const staleProposalDays = options.staleProposalDays ?? DEFAULT_STALE_DAYS;
        const backupDir = options.backupDir ?? DEFAULT_BACKUP_DIR;
        const assets = await this.database.db.select().from(assetRegistry);
        const repairedOrphanAssetIds = [];
        const updatedHashAssetIds = [];
        for (const asset of assets) {
            const exists = await fileExists(asset.path);
            if (!exists) {
                repairedOrphanAssetIds.push(asset.id);
                continue;
            }
            const currentHash = await hashFile(asset.path);
            if (currentHash && currentHash !== asset.hash) {
                updatedHashAssetIds.push(asset.id);
                await this.database.db
                    .update(assetRegistry)
                    .set({
                    hash: currentHash,
                    lastIndexedAt: now.toISOString(),
                })
                    .where(eq(assetRegistry.id, asset.id));
            }
        }
        if (repairedOrphanAssetIds.length > 0) {
            await this.database.db
                .delete(assetRegistry)
                .where(inArray(assetRegistry.id, repairedOrphanAssetIds));
        }
        const staleCutoff = new Date(now.getTime() - staleProposalDays * 24 * 60 * 60 * 1000).toISOString();
        const staleProposals = await this.database.db
            .select({ id: proposalRecords.id })
            .from(proposalRecords)
            .where(and(inArray(proposalRecords.status, ["draft", "requires_review"]), lt(proposalRecords.createdAt, staleCutoff)));
        const staleProposalIds = staleProposals.map((item) => item.id);
        if (staleProposalIds.length > 0) {
            await this.database.db
                .update(proposalRecords)
                .set({ status: "rejected" })
                .where(inArray(proposalRecords.id, staleProposalIds));
        }
        await fs.mkdir(backupDir, { recursive: true });
        const backupFileName = `state-${now.toISOString().replace(/[:.]/g, "-")}.db`;
        const backupPath = path.join(backupDir, backupFileName);
        await this.database.sqlite.backup(backupPath);
        return {
            scannedAssetCount: assets.length,
            repairedOrphanIndexCount: repairedOrphanAssetIds.length,
            updatedHashCount: updatedHashAssetIds.length,
            staleProposalCount: staleProposalIds.length,
            backupPath,
            repairedOrphanAssetIds,
            updatedHashAssetIds,
            staleProposalIds,
        };
    }
}
export function createRepairAndBackupService(database) {
    return new RepairAndBackupService(database);
}
