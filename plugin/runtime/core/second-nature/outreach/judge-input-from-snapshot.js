import { isLifeEvidenceSliceEmpty } from "../heartbeat/runtime-snapshot.js";
function toControlPlaneRefs(refs) {
    return refs.map((r) => ({
        id: r.id,
        kind: r.kind,
        uri: r.uri,
        excerptHash: r.excerptHash,
        observedAt: r.observedAt,
    }));
}
export function userInterestSnapshotToJudge(snapshot) {
    if (!snapshot) {
        return { staleness: "insufficient", confidence: 0, signals: [], sourceRefs: [] };
    }
    return {
        staleness: snapshot.staleness,
        confidence: snapshot.confidence,
        signals: snapshot.signals.map((s) => ({
            topic: s.topic,
            confidence: s.confidence,
            sourceRefs: s.sourceRefs.map((r) => ({
                id: r.id,
                kind: r.kind,
                uri: r.uri,
                excerptHash: r.excerptHash,
                observedAt: r.observedAt,
            })),
        })),
        sourceRefs: toControlPlaneRefs(snapshot.sourceRefs),
    };
}
export function buildJudgeOutreachInputFromSnapshot(intent, runtime, inputs) {
    const delivery = inputs.deliveryCapability ?? { target: "none" };
    const key = intent.idempotencyKey ?? intent.id;
    return {
        userInterest: userInterestSnapshotToJudge(inputs.userInterestSnapshot),
        lifeEvidence: {
            empty: isLifeEvidenceSliceEmpty(runtime.lifeEvidence),
            evidenceRefCount: runtime.lifeEvidence.evidenceRefs.length,
        },
        delivery,
        duplicateBlocked: runtime.hardGuards.hasDuplicateIntent(key),
        cooldownBlocked: !runtime.hardGuards.isOutreachCooldownClear(key),
    };
}
