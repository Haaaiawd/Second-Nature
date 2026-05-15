import type { ObservabilityDatabase } from "../db/index.js";
export interface RetentionCleanupInput {
    /** Delete rows with createdAt < this ISO string. */
    beforeDate: string;
}
export interface RetentionCleanupResult {
    decisionLedgerDeleted: number;
    executionAttemptsDeleted: number;
}
export declare function pruneObservabilityTables(db: ObservabilityDatabase, input: RetentionCleanupInput): Promise<RetentionCleanupResult>;
