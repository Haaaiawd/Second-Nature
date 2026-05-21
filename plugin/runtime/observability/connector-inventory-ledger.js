import { eq, desc } from "drizzle-orm";
import { connectorInventoryAudit } from "./db/schema/index.js";
export class ConnectorInventoryLedger {
    obs;
    constructor(obs) {
        this.obs = obs;
    }
    now() {
        return new Date().toISOString();
    }
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    }
    async recordAudit(input) {
        const auditId = this.generateId();
        const createdAt = this.now();
        await this.obs.db
            .insert(connectorInventoryAudit)
            .values({
            auditId,
            snapshotId: input.snapshotId,
            scanned: input.scanned,
            registered: input.registered,
            skipped: input.skipped,
            conflictsJson: JSON.stringify(input.conflicts ?? []),
            validationErrorsJson: JSON.stringify(input.validationErrors ?? []),
            trustSummaryJson: JSON.stringify(input.trustSummary ?? {}),
            createdAt,
        })
            .execute();
        return auditId;
    }
    async getLatestAudit(snapshotId) {
        const result = await this.obs.db
            .select()
            .from(connectorInventoryAudit)
            .where(eq(connectorInventoryAudit.snapshotId, snapshotId))
            .orderBy(desc(connectorInventoryAudit.createdAt))
            .limit(1)
            .execute();
        if (!result || result.length === 0)
            return undefined;
        const row = result[0];
        return this.rowToSnapshot(row);
    }
    async listAudits(opts) {
        const limit = opts?.limit ?? 100;
        const offset = opts?.offset ?? 0;
        const rows = await this.obs.db
            .select()
            .from(connectorInventoryAudit)
            .orderBy(desc(connectorInventoryAudit.createdAt))
            .limit(limit)
            .offset(offset)
            .execute();
        return rows.map((r) => this.rowToSnapshot(r));
    }
    rowToSnapshot(row) {
        const r = row;
        return {
            auditId: String(r.auditId),
            snapshotId: String(r.snapshotId),
            scanned: Number(r.scanned),
            registered: Number(r.registered),
            skipped: Number(r.skipped),
            conflicts: JSON.parse(String(r.conflictsJson ?? "[]")),
            validationErrors: JSON.parse(String(r.validationErrorsJson ?? "[]")),
            trustSummary: JSON.parse(String(r.trustSummaryJson ?? "{}")),
            createdAt: String(r.createdAt),
        };
    }
}
