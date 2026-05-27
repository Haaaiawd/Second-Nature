/**
 * DreamInputLoader — T-DQS.C.2 (DR-026: Idempotent Claim Loading)
 *
 * Core logic: Load unreferenced QuietClaims as Dream inputs.
 *
 * Idempotent mechanism (DR-026):
 * - Queries daily_diary_index + life_evidence_index for candidate source refs.
 * - Excludes refs already consumed by accepted dream_output_index projections.
 * - When Dream lock is held, claims are queued; on next Dream run after lock release,
 *   they are automatically included (no separate "skipped" tracking needed).
 * - Subsequent Dream runs exclude already-accepted refs, preventing re-processing.
 *
 * Lock semantics:
 * - Lock TTL is 35min (enforced by DreamScheduler, not this module).
 * - This loader only reads; lock enforcement is upstream.
 *
 * ToolExperience summaries:
 * - Loads recent tool_experience records aggregated by (connector_id, capability_id, outcome).
 * - Provides frequency count and last recorded time for Dream insight extraction.
 *
 * Contract:
 * - Returns empty evidenceRefs when no unreferenced claims exist.
 * - Never fabricates inputs; only reads from existing DB state.
 *
 * Performance: O(n) where n = life_evidence_index rows (capped by LIMIT).
 * Memory: O(m) where m = deduplicated ref count (typically < evidenceLimit).
 *
 * Test coverage: tests/unit/dream/dream-input-loader.test.ts
 */
import type { Database } from "sql.js";
import type { DreamStatePort } from "./types.js";
export interface DreamInputLoaderOptions {
    database: {
        sqlite: Database;
    };
}
export declare function createDreamInputLoader(options: DreamInputLoaderOptions): Pick<DreamStatePort, "loadDreamInputs">;
