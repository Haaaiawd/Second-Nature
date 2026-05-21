import type { ObservabilityDatabase } from "./db/index.js";
export interface InventorySnapshot {
    auditId: string;
    snapshotId: string;
    scanned: number;
    registered: number;
    skipped: number;
    conflicts: Array<{
        connectorId: string;
        reason: string;
    }>;
    validationErrors: Array<{
        connectorId: string;
        errors: string[];
    }>;
    trustSummary: Record<string, number>;
    createdAt: string;
}
export declare class ConnectorInventoryLedger {
    private obs;
    constructor(obs: ObservabilityDatabase);
    private now;
    private generateId;
    recordAudit(input: {
        snapshotId: string;
        scanned: number;
        registered: number;
        skipped: number;
        conflicts?: Array<{
            connectorId: string;
            reason: string;
        }>;
        validationErrors?: Array<{
            connectorId: string;
            errors: string[];
        }>;
        trustSummary?: Record<string, number>;
    }): Promise<string>;
    getLatestAudit(snapshotId: string): Promise<InventorySnapshot | undefined>;
    listAudits(opts?: {
        limit?: number;
        offset?: number;
    }): Promise<InventorySnapshot[]>;
    private rowToSnapshot;
}
