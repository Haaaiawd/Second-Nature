/**
 * AttentionSignalValidator — Final validation gate for AttentionSignal.
 *
 * Core logic: Enforce source ref integrity, summary bounds, action bounds,
 * and novelty/repetition consistency. Missing source refs downgrade the
 * signal to attention_blocked_missing_sources and strip write-side actions.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/attention-system.detail.md §2.2 §3.6 §5.1`
 *
 * Dependencies:
 * - `src/shared/types/v9-contracts.js` (AttentionSignal, AttentionActionKind, SourceRef)
 *
 * Boundary:
 * - Does not mutate evidence rows.
 * - Does not call action-closure-policy-system.
 *
 * Test coverage: tests/unit/attention/v9-attention-assembler.test.ts
 */
import type { AttentionSignal } from "../../../shared/types/v9-contracts.js";
export interface ValidationResult {
    signal: AttentionSignal;
    blocked: boolean;
}
export declare function validateAttentionSignal(draft: AttentionSignal): ValidationResult;
