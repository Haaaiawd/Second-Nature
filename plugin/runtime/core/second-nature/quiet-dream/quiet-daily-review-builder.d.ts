/**
 * QuietDailyReviewBuilder — Aggregate daily closures, perceptions, and
 * memory-review candidates into a readable, source-backed QuietDailyReview.
 *
 * Core logic: Read ActionClosureRecords by day, collect memory-review
 * candidates and attached PerceptionCard summaries, build a human-readable
 * review, and write QuietDailyReview row.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.detail.md §3.1`
 * - `.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.md §4.2`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (readActionClosuresByDay, readPerceptionCardById, writeQuietDailyReview)
 * - `src/shared/types/v8-contracts.js` (SourceRef, DegradedOperationResult, V8ReasonCode)
 *
 * Boundary:
 * - Does not form long-term memory; only emits review input for Dream.
 * - Does not judge importance; reads closure status and risk flags.
 * - Degrades gracefully on unreadable state.
 *
 * Test coverage: tests/unit/quiet/quiet-daily-review-builder.test.ts
 */
import type { StateDatabase } from "../../../storage/db/index.js";
import type { SourceRef, DegradedOperationResult, V8ReasonCode } from "../../../shared/types/v8-contracts.js";
export interface QuietReviewEntry {
    closureId: string;
    platformId?: string;
    actionKind?: string;
    status: string;
    summary?: string;
    reason?: string;
}
export interface QuietDailyReviewResult {
    id: string;
    day: string;
    closureCount: number;
    memoryCandidateCount: number;
    /** Generic source refs (closure + perception + other) */
    sourceRefs: SourceRef[];
    /** Explicit closure refs — first-class provenance for reviewed ActionClosureRecords */
    closureRefs: SourceRef[];
    reviewSummary: string;
    /** Human-readable review sections */
    sections: QuietReviewSection[];
    importanceSignals: string[];
    createdAt: string;
}
export interface QuietReviewSection {
    kind: "headline" | "completed" | "deferred" | "failed" | "memory_candidates" | "observations";
    title: string;
    lines: string[];
}
export interface BuildQuietDailyReviewOptions {
    day?: string;
    now?: string;
}
export type BuildQuietDailyReviewOutput = {
    status: "completed";
    review: QuietDailyReviewResult;
} | {
    status: "empty";
    reason: V8ReasonCode;
} | DegradedOperationResult;
export type QuietReviewContentStatus = "content_present" | "empty" | "placeholder_rejected" | "content_missing";
export declare function buildQuietDailyReview(db: StateDatabase, options?: BuildQuietDailyReviewOptions): Promise<BuildQuietDailyReviewOutput>;
