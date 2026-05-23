/**
 * PainSignal query — T-BTS.C.4
 *
 * Core logic: Computes a bounded pain signal from recent ToolExperience rows.
 * Does NOT expose raw payload. Returns aggregated metrics for affordance map
 * and heartbeat guard consumption.
 *
 * Dependencies:
 * - `ToolExperienceStore` from `../../../../storage/services/tool-experience-store.js`
 * - `ToolExperience` from `../../../../shared/types/v7-entities.js`
 *
 * Boundary:
 * - Read-only; no side effects.
 * - Bounded to last N rows (default 10) to keep computation constant-time.
 *
 * Test coverage: tests/unit/body/pain-signal-query.test.ts
 */
import type { ToolExperienceStore } from "../../../../storage/services/tool-experience-store.js";
export interface PainSignal {
    connectorId: string;
    capabilityId: string;
    painLevel: number;
    recentFailureRate: number;
    consecutiveFailures: number;
    cooldownRecommended: boolean;
    lastOutcomes: Array<{
        outcome: string;
        createdAt: string;
    }>;
}
export interface PainSignalQuery {
    getPainSignal(connectorId: string, capabilityId?: string): Promise<PainSignal | undefined>;
}
export declare function createPainSignalQuery(store: ToolExperienceStore, options?: {
    lookbackLimit?: number;
    cooldownThreshold?: number;
}): PainSignalQuery;
