/**
 * User interest read model (T4.2.2 / state-system v5 subset).
 *
 * Test coverage: tests/unit/storage/user-interest-snapshot.test.ts
 */
import type { SourceRef } from "../life-evidence/types.js";

export type UserInterestStaleness = "fresh" | "stale" | "insufficient";

export interface UserInterestSignal {
  id: string;
  topic: string;
  affinity: "positive" | "negative" | "watching" | "unknown";
  reason: string;
  confidence: number;
  sourceRefs: SourceRef[];
  updatedAt: string;
}

export interface UserInterestSnapshot {
  snapshotId: string;
  generatedAt: string;
  signals: UserInterestSignal[];
  sourceRefs: SourceRef[];
  confidence: number;
  staleness: UserInterestStaleness;
  missingReasons?: string[];
}
