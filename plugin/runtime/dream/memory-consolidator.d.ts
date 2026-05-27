/**
 * Rules-based memory consolidation.
 *
 * Core logic: dedupe, merge, stale cleanup, and conflict marking on evidence,
 * chronicle, and existing memory entries. No LLM required.
 *
 * - Deduplicate by sourceRef id + kind; keep the most recent.
 * - Merge entries with same kind + similar summary (naive prefix match).
 * - Mark entries older than 90 days as stale (retain but flag).
 * - Mark entries with conflicting sourceRefs as conflict.
 * Test coverage: tests/integration/dream/t7-1-1-dream-pipeline.test.ts
 */
import type { CanonicalMemoryEntry, SourceRef } from "../storage/memory-store/memory-store-lifecycle.js";
export interface ConsolidationInput {
    evidenceSummaries: Array<{
        id: string;
        summary: string;
        sourceRefs: SourceRef[];
        createdAt: string;
        sensitivity?: string;
    }>;
    chronicleSummaries: Array<{
        id: string;
        summary: string;
        sourceRefs: SourceRef[];
        createdAt: string;
    }>;
    toolExperienceSummaries?: Array<{
        id: string;
        summary: string;
        sourceRefs: SourceRef[];
        createdAt: string;
    }>;
    existingEntries: CanonicalMemoryEntry[];
}
export interface ConsolidationResult {
    entries: CanonicalMemoryEntry[];
    conflicts: Array<{
        entryId: string;
        reason: string;
    }>;
    staleCount: number;
    dedupeCount: number;
}
export declare function consolidateMemory(input: ConsolidationInput): ConsolidationResult;
