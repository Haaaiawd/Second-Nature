/**
 * User interest read model (T4.2.2 / state-system v5 subset).
 *
 * Test coverage: tests/unit/storage/user-interest-snapshot.test.ts
 */
import type { LifeEvidenceSourceRef } from "../life-evidence/types.js";
export type UserInterestStaleness = "fresh" | "stale" | "insufficient";
export interface UserInterestSignal {
    id: string;
    topic: string;
    affinity: "positive" | "negative" | "watching" | "unknown";
    reason: string;
    confidence: number;
    sourceRefs: LifeEvidenceSourceRef[];
    updatedAt: string;
}
export interface UserInterestSnapshot {
    snapshotId: string;
    generatedAt: string;
    signals: UserInterestSignal[];
    sourceRefs: LifeEvidenceSourceRef[];
    confidence: number;
    staleness: UserInterestStaleness;
    missingReasons?: string[];
}
