import { eq, desc } from "drizzle-orm";
import type { ObservabilityDatabase } from "./db/index.js";
import { connectorInventoryAudit } from "./db/schema/index.js";

export interface InventorySnapshot {
  auditId: string;
  snapshotId: string;
  scanned: number;
  registered: number;
  skipped: number;
  conflicts: Array<{ connectorId: string; reason: string }>;
  validationErrors: Array<{ connectorId: string; errors: string[] }>;
  trustSummary: Record<string, number>;
  createdAt: string;
}

export class ConnectorInventoryLedger {
  constructor(private obs: ObservabilityDatabase) {}

  private now(): string {
    return new Date().toISOString();
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  async recordAudit(input: {
    snapshotId: string;
    scanned: number;
    registered: number;
    skipped: number;
    conflicts?: Array<{ connectorId: string; reason: string }>;
    validationErrors?: Array<{ connectorId: string; errors: string[] }>;
    trustSummary?: Record<string, number>;
  }): Promise<string> {
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

  async getLatestAudit(
    snapshotId: string
  ): Promise<InventorySnapshot | undefined> {
    const result = await this.obs.db
      .select()
      .from(connectorInventoryAudit)
      .where(eq(connectorInventoryAudit.snapshotId, snapshotId))
      .orderBy(desc(connectorInventoryAudit.createdAt))
      .limit(1)
      .execute();

    if (!result || result.length === 0) return undefined;
    const row = result[0];
    return this.rowToSnapshot(row);
  }

  async listAudits(opts?: {
    limit?: number;
    offset?: number;
  }): Promise<InventorySnapshot[]> {
    const limit = opts?.limit ?? 100;
    const offset = opts?.offset ?? 0;

    const rows = await this.obs.db
      .select()
      .from(connectorInventoryAudit)
      .orderBy(desc(connectorInventoryAudit.createdAt))
      .limit(limit)
      .offset(offset)
      .execute();

    return rows.map((r: unknown) => this.rowToSnapshot(r));
  }

  private rowToSnapshot(row: unknown): InventorySnapshot {
    const r = row as Record<string, unknown>;
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
