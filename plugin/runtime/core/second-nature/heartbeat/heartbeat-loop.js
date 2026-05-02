import { buildContinuitySnapshot } from "./snapshot-builder.js";
import { planIntent } from "../orchestrator/intent-planner.js";
import { evaluateGuards } from "../orchestrator/guard-layer.js";
/**
 * Ingest a heartbeat rhythm signal and drive one full decision round.
 *
 * Decision flow:
 * 1. Build continuity snapshot from state-system inputs
 * 2. Plan candidate intents from snapshot
 * 3. Evaluate guards for each candidate in priority order
 * 4. Return one of:
 *    - intent_selected: a candidate passed all guards
 *    - denied: candidates existed but all were rejected by guards
 *    - heartbeat_ok: no candidates or no action warranted (conservative default)
 *
 * Per ADR-005: heartbeat is the free-rhythm main entry; this loop
 * implements the default conservative path where HEARTBEAT_OK is
 * the first-class result when no action is warranted.
 */
export async function ingestRhythmSignal(signal, deps) {
    // Step 1: Build continuity snapshot
    const inputs = await deps.loadSnapshotInputs();
    const snapshot = buildContinuitySnapshot(inputs);
    // Step 2: Plan candidate intents
    const candidates = planIntent(snapshot);
    // Step 3: Evaluate guards for each candidate (priority order)
    let hasCandidates = false;
    let anyAllow = false;
    const denyReasons = [];
    for (const intent of candidates) {
        hasCandidates = true;
        const evaluation = evaluateGuards(intent, snapshot);
        if (evaluation.verdict === "allow") {
            anyAllow = true;
            return {
                scope: "rhythm",
                status: "intent_selected",
                selectedIntentId: intent.id,
                reasons: evaluation.reasons,
            };
        }
        denyReasons.push(`${intent.id}:${evaluation.verdict}(${evaluation.reasons.join(",")})`);
    }
    // Step 4: No viable intent path
    if (!hasCandidates) {
        // No candidates at all → heartbeat_ok (nothing to do)
        return {
            scope: "rhythm",
            status: "heartbeat_ok",
            reasons: ["silent_no_candidates"],
        };
    }
    if (!anyAllow && denyReasons.length > 0) {
        // Candidates existed but all denied/deferred/escalated → denied
        return {
            scope: "rhythm",
            status: "denied",
            reasons: denyReasons,
        };
    }
    // Fallback: conservative heartbeat_ok
    return {
        scope: "rhythm",
        status: "heartbeat_ok",
        reasons: ["no_allow_verdict"],
    };
}
/**
 * Build a snapshot directly from inputs (for testing or when state-system is unavailable).
 */
export function buildSnapshotFromInputs(inputs) {
    return buildContinuitySnapshot(inputs);
}
