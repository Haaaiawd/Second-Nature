/**
 * Maps control-plane judgment + delivery resolution into guidance OutreachDraftRequest (T6.2.1).
 * Aligns with control-plane-system.detail §3.9 buildOutreachDraftRequest.
 */
import * as crypto from "node:crypto";
function inferRhythmWindowKind(windowId) {
    const id = windowId.toLowerCase();
    if (id.includes("work"))
        return "work";
    if (id.includes("social"))
        return "social";
    if (id.includes("quiet"))
        return "quiet";
    if (id.includes("reflect"))
        return "reflection";
    if (id.includes("explore"))
        return "exploration";
    return undefined;
}
function toGuidanceRefs(refs) {
    return refs.map((r) => ({
        id: r.id,
        kind: r.kind,
        uri: r.uri,
        excerptHash: r.excerptHash,
        observedAt: r.observedAt,
    }));
}
function mapDeliveryVerdict(verdict) {
    switch (verdict) {
        case "target_available":
            return "target_available";
        case "target_none":
            return "target_none";
        case "channel_missing":
            return "channel_missing";
        case "host_unsupported":
            return "host_unsupported";
        default:
            return "host_unsupported";
    }
}
function buildNarrativeContext(state) {
    if (!state)
        return undefined;
    return {
        focus: state.focus || undefined,
        progress: state.progress.length > 0 ? state.progress : undefined,
        nextIntent: state.nextIntent || undefined,
        sourceRefs: state.sourceRefs.map((r) => ({
            id: r.sourceId,
            kind: "user_anchor",
            uri: r.url || "",
            excerptHash: r.snippet,
            observedAt: undefined,
        })),
    };
}
function buildRelationshipContext(memory) {
    if (!memory)
        return undefined;
    const avgAffinity = memory.topicAffinities.length > 0
        ? memory.topicAffinities.reduce((s, t) => s + t.affinity, 0) /
            memory.topicAffinities.length
        : 0;
    return {
        tone: memory.tonePreference,
        topicAffinities: memory.topicAffinities.map((t) => t.topic),
        avgAffinity,
        sourceRefs: memory.sourceRefs?.map((r) => ({
            id: r.sourceId,
            kind: "user_anchor",
            uri: r.url || "",
            excerptHash: r.snippet,
            observedAt: undefined,
        })),
    };
}
export function buildOutreachDraftRequest(candidate, judgment, snapshot, delivery, narrativeState, relationshipMemory) {
    const sceneType = delivery.verdict === "target_available" ? "outreach" : "fallback_candidate";
    const riskLevel = delivery.verdict === "target_available" ? "medium" : "low";
    return {
        requestId: `outreach_draft_request:${crypto.randomUUID()}`,
        sceneType,
        runtimeScope: "rhythm",
        rhythmWindowKind: inferRhythmWindowKind(snapshot.rhythmWindow.windowId),
        riskLevel,
        sourceRefs: toGuidanceRefs(judgment.sourceRefs),
        decisionId: judgment.decisionId,
        candidateId: candidate.id,
        judgmentVerdict: judgment.verdict,
        valueScore: judgment.valueScore,
        interestRefs: toGuidanceRefs(judgment.interestRefs),
        narrativeContext: buildNarrativeContext(narrativeState),
        relationshipContext: buildRelationshipContext(relationshipMemory),
        deliveryContext: {
            deliveryVerdict: mapDeliveryVerdict(delivery.verdict),
            wordingMode: delivery.verdict === "target_available" ? "sendable" : "not_sent_fallback_candidate",
        },
    };
}
