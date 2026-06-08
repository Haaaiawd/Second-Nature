/**
 * DreamConsolidationRunner — Generate memory candidates from Quiet review.
 *
 * Core logic: Read DreamConsolidationRun and associated QuietDailyReview,
 * apply rules-only candidate generation, redaction gate, validation,
 * and update run status to completed/failed/blocked.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.detail.md §3.3`
 * - `.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.md §4.2`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (readDreamConsolidationRunById, readQuietDailyReviewById, writeLongTermMemoryProjection)
 * - `src/shared/types/v8-contracts.js` (SourceRef, DegradedOperationResult, V8ReasonCode)
 *
 * Boundary:
 * - Rules-only candidate generation; no model assist in this version.
 * - Does not accept/reject projections; only creates candidates.
 * - Redaction gate blocks sensitive private content, preserves public technical.
 *
 * Test coverage: tests/unit/dream/dream-consolidation-runner.test.ts
 */
import type { StateDatabase } from "../../../storage/db/index.js";
import type { SourceRef, DegradedOperationResult, V8ReasonCode } from "../../../shared/types/v8-contracts.js";
export interface DreamMemoryCandidate {
    id: string;
    runId: string;
    reviewId: string;
    candidateText: string;
    sourceRefs: SourceRef[];
    confidence: number;
    validationStatus: "valid" | "rejected" | "blocked";
    validationReason?: string;
}
export interface RunDreamConsolidationResult {
    runId: string;
    status: "completed" | "failed" | "blocked";
    candidates: DreamMemoryCandidate[];
    reason?: V8ReasonCode;
}
export interface RunDreamConsolidationOptions {
    now?: string;
}
export declare function runDreamConsolidation(db: StateDatabase, runId: string, options?: RunDreamConsolidationOptions): Promise<RunDreamConsolidationResult | DegradedOperationResult>;
