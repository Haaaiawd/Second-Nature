import { buildContinuitySnapshot } from "./snapshot-builder.js";
import { buildHeartbeatRuntimeSnapshot } from "./runtime-snapshot.js";
import { planCandidateIntents } from "../orchestrator/intent-planner.js";
import { evaluateHardGuards } from "../orchestrator/guard-layer.js";
/**
 * Ingest a heartbeat rhythm signal and drive one full decision round.
 */
export async function ingestRhythmSignal(signal, deps) {
    const inputs = await deps.loadSnapshotInputs();
    const snapshot = buildContinuitySnapshot(inputs);
    const timestamp = signal.payload.timestamp;
    const runtime = buildHeartbeatRuntimeSnapshot(timestamp, inputs, snapshot);
    const candidates = planCandidateIntents(runtime);
    const emitTrace = async (result) => {
        if (!deps.recordDecisionTrace)
            return;
        await deps.recordDecisionTrace({
            scope: result.scope,
            status: result.status,
            reasons: result.reasons,
            selectedIntentId: result.selectedIntentId,
            rhythmWindowId: runtime.rhythmWindow.windowId,
            allowedIntentKinds: [...runtime.rhythmWindow.allowedIntentKinds],
            candidateCount: candidates.length,
            lifeEvidenceEmpty: runtime.lifeEvidence.evidenceRefs.length === 0 &&
                runtime.lifeEvidence.platformEventCount === 0 &&
                runtime.lifeEvidence.workEventCount === 0,
            trigger: signal.trigger,
        });
    };
    let hasCandidates = false;
    let anyAllow = false;
    let anyDefer = false;
    let anyDeny = false;
    const denyReasons = [];
    for (const intent of candidates) {
        hasCandidates = true;
        const evaluation = evaluateHardGuards(intent, runtime);
        if (evaluation.verdict === "allow") {
            anyAllow = true;
            const result = {
                scope: "rhythm",
                status: "intent_selected",
                selectedIntentId: intent.id,
                reasons: evaluation.reasons,
            };
            await emitTrace(result);
            return result;
        }
        if (evaluation.verdict === "defer") {
            anyDefer = true;
            denyReasons.push(`${intent.id}:${evaluation.verdict}(${evaluation.reasons.join(",")})`);
            continue;
        }
        anyDeny = true;
        denyReasons.push(`${intent.id}:${evaluation.verdict}(${evaluation.reasons.join(",")})`);
    }
    if (!hasCandidates) {
        const result = {
            scope: "rhythm",
            status: "heartbeat_ok",
            reasons: ["silent_no_candidates"],
        };
        await emitTrace(result);
        return result;
    }
    if (!anyAllow && anyDefer && !anyDeny) {
        const result = {
            scope: "rhythm",
            status: "deferred",
            reasons: denyReasons.length > 0 ? denyReasons : ["all_candidates_deferred"],
        };
        await emitTrace(result);
        return result;
    }
    if (!anyAllow && denyReasons.length > 0) {
        const result = {
            scope: "rhythm",
            status: "denied",
            reasons: denyReasons,
        };
        await emitTrace(result);
        return result;
    }
    const result = {
        scope: "rhythm",
        status: "heartbeat_ok",
        reasons: ["no_allow_verdict"],
    };
    await emitTrace(result);
    return result;
}
/**
 * Build a snapshot directly from inputs (for testing or when state-system is unavailable).
 */
export function buildSnapshotFromInputs(inputs) {
    return buildContinuitySnapshot(inputs);
}
