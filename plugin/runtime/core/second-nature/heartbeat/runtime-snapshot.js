import { rhythmPolicySnapshotToRhythmPolicy } from "../rhythm/policy-bridge.js";
import { buildPlannerRhythmWindow } from "../rhythm/planner-rhythm-window.js";
export function isLifeEvidenceSliceEmpty(slice) {
    return slice.evidenceRefs.length === 0 && slice.platformEventCount === 0 && slice.workEventCount === 0;
}
export function buildLifeEvidenceSliceFromInputs(inputs) {
    return {
        evidenceRefs: inputs.lifeEvidenceRefs ?? [],
        platformEventCount: inputs.platformEventCount ?? 0,
        workEventCount: inputs.workEventCount ?? 0,
        emptyReason: inputs.lifeEvidenceEmptyReason,
    };
}
export function buildHardGuardDeps(continuity, inputs) {
    return {
        hasDuplicateIntent: (key) => (inputs.duplicateIntentKeys?.includes(key) ?? false) ||
            continuity.deniedIntents.some((d) => d.reason === "duplicate_intent" && d.intentHash === key),
        isOutreachCooldownClear: (key) => !(inputs.outreachCooldownKeys?.includes(key) ?? false),
    };
}
export function resolveRhythmPolicyForHeartbeat(inputs) {
    if (inputs.rhythmPolicy) {
        return inputs.rhythmPolicy;
    }
    return rhythmPolicySnapshotToRhythmPolicy({
        quietEnabled: inputs.quietEnabledBridge ?? false,
    });
}
export function buildHeartbeatRuntimeSnapshot(timestamp, inputs, continuity) {
    const policy = resolveRhythmPolicyForHeartbeat(inputs);
    const rhythmWindow = buildPlannerRhythmWindow(timestamp, continuity, policy);
    const lifeEvidence = buildLifeEvidenceSliceFromInputs(inputs);
    const hardGuards = buildHardGuardDeps(continuity, inputs);
    return {
        continuity,
        lifeEvidence,
        rhythmWindow,
        hardGuards,
        narrativeState: inputs.narrativeState,
        relationshipMemory: inputs.relationshipMemory,
        affordanceMap: inputs.affordanceMap,
    };
}
