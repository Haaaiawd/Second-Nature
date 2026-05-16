/**
 * T2.1.5 — NarrativeState update after heartbeat effect/fallback.
 *
 * Produces a source-backed narrative revision or an honest empty-state
 * (`awaiting_sources` / `insufficient_sources`) based on the cycle result.
 *
 * Rules-only implementation; no live LLM.
 */
import type { HeartbeatCycleResult } from "../heartbeat/signal.js";
import type { CandidateIntent } from "../types.js";
import type { PlannerLifeEvidenceSlice } from "../heartbeat/runtime-snapshot.js";
import type { NarrativeState, NarrativeStateUpdate } from "../../../storage/narrative/narrative-state-store.js";
export interface UpdateNarrativeAfterEffectInput {
    result: HeartbeatCycleResult;
    selectedIntent?: CandidateIntent;
    lifeEvidence: PlannerLifeEvidenceSlice;
    priorNarrative?: NarrativeState | null;
}
/**
 * Build the next NarrativeState revision from a completed heartbeat cycle.
 *
 * - `intent_selected` + sources → `active`, focus/progress updated.
 * - `intent_selected` without sources → `awaiting_sources`, claim recorded as unsupported.
 * - No action (heartbeat_ok / denied / deferred / etc.) → preserve prior state or
 *   seed an empty `awaiting_sources` state when no prior exists.
 */
export declare function updateNarrativeAfterEffect(input: UpdateNarrativeAfterEffectInput): NarrativeStateUpdate;
