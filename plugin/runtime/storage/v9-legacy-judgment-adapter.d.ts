/**
 * v8 JudgmentVerdict → v9 AttentionSignal legacy adapter.
 *
 * Core logic: Read a v8 `judgment_verdict` row and return a degraded
 * `AttentionSignal` for observability replay / historical queries only.
 * The mapped signal must NOT enter the v9 real-time action cycle.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/memory-continuity-system.detail.md §3.1a`
 * - `.anws/v9/04_SYSTEM_DESIGN/attention-system.detail.md §2.2`
 * - `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md §3`
 *
 * Dependencies:
 * - `src/storage/db/schema/v8-entities.js` (judgmentVerdict)
 * - `src/shared/types/v9-contracts.js` (AttentionSignal, SourceRef)
 *
 * Test coverage: tests/unit/memory/v9-legacy-judgment-adapter.test.ts
 */
import type { StateDatabase } from "./db/index.js";
import type { AttentionSignal } from "../shared/types/v9-contracts.js";
export interface LegacyJudgmentAdapterResult {
    kind: "mapped" | "not_found";
    signal?: AttentionSignal;
}
export declare function readLegacyJudgmentVerdictAsAttentionSignal(db: StateDatabase, judgmentId: string): Promise<LegacyJudgmentAdapterResult>;
