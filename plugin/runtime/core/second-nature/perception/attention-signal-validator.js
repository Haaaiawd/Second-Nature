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
import { ATTENTION_SUMMARY_MAX_CHARS, POSSIBLE_ACTIONS_MAX_COUNT, } from "./attention-scorer.js";
function hasWritableSources(sourceRefs) {
    if (!sourceRefs || sourceRefs.length === 0)
        return false;
    return sourceRefs.every((ref) => typeof ref.id === "string" && ref.id.length > 0 && typeof ref.family === "string");
}
export function validateAttentionSignal(draft) {
    let signal = { ...draft };
    let blocked = false;
    if (!hasWritableSources(signal.sourceRefs)) {
        signal = {
            ...signal,
            status: "attention_blocked_missing_sources",
            reason: "missing_source_refs",
            possibleActions: ["defer"],
            threadSuggestion: "none",
            activityThreadId: undefined,
        };
        blocked = true;
    }
    if (signal.summary.length > ATTENTION_SUMMARY_MAX_CHARS) {
        signal = {
            ...signal,
            summary: `${signal.summary.slice(0, ATTENTION_SUMMARY_MAX_CHARS - 1)}…`,
        };
    }
    if (signal.possibleActions.length > POSSIBLE_ACTIONS_MAX_COUNT) {
        signal = {
            ...signal,
            possibleActions: signal.possibleActions.slice(0, POSSIBLE_ACTIONS_MAX_COUNT),
        };
    }
    // Consistency: duplicate/unstable must have novelty 0.
    if (signal.repetition === "duplicate" || signal.repetition === "identity_unstable") {
        signal = { ...signal, novelty: 0 };
    }
    if (signal.repetition === "new" && signal.novelty !== 1.0) {
        signal = { ...signal, novelty: 1.0 };
    }
    if (signal.repetition === "changed" && signal.novelty !== 0.5) {
        signal = { ...signal, novelty: 0.5 };
    }
    // Invariant: continue/pause/complete require an existing activity thread id.
    const needsThreadId = signal.threadSuggestion === "continue" || signal.threadSuggestion === "pause" || signal.threadSuggestion === "complete";
    if (needsThreadId && !signal.activityThreadId) {
        signal = { ...signal, threadSuggestion: "none", activityThreadId: undefined };
    }
    return { signal, blocked };
}
