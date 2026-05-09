import { isLifeEvidenceSliceEmpty } from "../heartbeat/runtime-snapshot.js";
import { buildHeartbeatRuntimeSnapshot } from "../heartbeat/runtime-snapshot.js";
const MAX_CANDIDATE_INTENTS = 6;
const OBLIGATION_SOURCE = [
    { id: "obligation-anchor", kind: "workspace_artifact", uri: "workspace://obligations/pending" },
];
function evidenceRefsForConnector(runtime) {
    if (!isLifeEvidenceSliceEmpty(runtime.lifeEvidence) && runtime.lifeEvidence.evidenceRefs.length > 0) {
        return runtime.lifeEvidence.evidenceRefs.slice(0, 8);
    }
    if (!isLifeEvidenceSliceEmpty(runtime.lifeEvidence)) {
        return [
            {
                id: "life-evidence-summary",
                kind: "connector_result",
                uri: `workspace://life-evidence/counts/${runtime.lifeEvidence.platformEventCount}/${runtime.lifeEvidence.workEventCount}`,
            },
        ];
    }
    return [];
}
function isAllowedKind(kind, runtime) {
    return runtime.rhythmWindow.allowedIntentKinds.includes(kind);
}
function planWorkIntents(runtime) {
    if (!isAllowedKind("work", runtime))
        return [];
    return runtime.continuity.pendingObligations.map((obligation, index) => ({
        id: `intent-obligation-${index}`,
        kind: "work",
        priority: 100 - index,
        source: "obligation",
        summary: `fulfill obligation: ${obligation}`,
        effectClass: "connector_action",
        sourceRefs: [...OBLIGATION_SOURCE],
        idempotencyKey: `obligation:${obligation}:${index}`,
    }));
}
function planExplorationIntents(runtime) {
    if (!isAllowedKind("exploration", runtime))
        return [];
    const refs = evidenceRefsForConnector(runtime);
    return [
        {
            id: "intent-exploration",
            kind: "exploration",
            priority: 70,
            source: "tick",
            summary: "scan platform opportunities",
            effectClass: "connector_action",
            sourceRefs: refs,
            idempotencyKey: "exploration:scan platform opportunities",
        },
    ];
}
function planSocialIntents(runtime) {
    if (!isAllowedKind("social", runtime))
        return [];
    const refs = evidenceRefsForConnector(runtime);
    return [
        {
            id: "intent-social",
            kind: "social",
            priority: runtime.continuity.budgets && runtime.continuity.budgets.socialUsed >= runtime.continuity.budgets.socialLimit ? 10 : 60,
            source: "tick",
            summary: "engage social platforms",
            effectClass: "connector_action",
            sourceRefs: refs,
            idempotencyKey: "social:engage social platforms",
        },
    ];
}
function planQuietReflectionIntents(runtime) {
    if (!runtime.rhythmWindow.quietBias && runtime.continuity.mode !== "quiet") {
        return [];
    }
    const out = [];
    if (isAllowedKind("quiet", runtime)) {
        out.push({
            id: "intent-quiet",
            kind: "quiet",
            priority: 55,
            source: "quiet_plan",
            summary: "quiet window bookkeeping",
            effectClass: "no_effect",
            sourceRefs: [],
            idempotencyKey: "quiet:bookkeeping",
        });
    }
    if (isAllowedKind("maintenance", runtime)) {
        out.push({
            id: "intent-maintenance",
            kind: "maintenance",
            priority: 50,
            source: "quiet_plan",
            summary: "run maintenance checks",
            effectClass: "maintenance",
            sourceRefs: [],
            idempotencyKey: "maintenance:checks",
        });
    }
    if (isAllowedKind("reflection", runtime)) {
        const refs = evidenceRefsForConnector(runtime);
        out.push({
            id: "intent-reflection",
            kind: "reflection",
            priority: 45,
            source: "quiet_plan",
            summary: "run narrative reflection",
            effectClass: "narrative_reflection",
            sourceRefs: refs,
            idempotencyKey: "reflection:narrative",
        });
    }
    return out;
}
function planOutreachIntents(runtime) {
    if (!isAllowedKind("outreach", runtime))
        return [];
    if (runtime.continuity.recentOutreachHashes.length > 3) {
        return [];
    }
    const refs = evidenceRefsForConnector(runtime);
    return [
        {
            id: "intent-outreach",
            kind: "outreach",
            priority: 40,
            source: "tick",
            summary: "consider proactive user outreach",
            effectClass: "user_outreach",
            sourceRefs: refs,
            idempotencyKey: "outreach:consider proactive user outreach",
        },
    ];
}
/**
 * Plan ordered candidates for one heartbeat turn using rhythm window + life evidence slice.
 */
export function planCandidateIntents(runtime) {
    if (runtime.continuity.mode === "paused_for_interrupt") {
        const pausedMaintenance = [
            {
                id: "intent-maintenance",
                kind: "maintenance",
                priority: 40,
                source: "tick",
                summary: "run maintenance checks",
                effectClass: "maintenance",
                sourceRefs: [],
                idempotencyKey: "maintenance:checks",
            },
        ];
        return pausedMaintenance
            .filter((intent) => runtime.rhythmWindow.allowedIntentKinds.includes(intent.kind))
            .slice(0, MAX_CANDIDATE_INTENTS);
    }
    if (runtime.continuity.mode === "maintenance_only") {
        return planWorkIntents(runtime).sort((a, b) => b.priority - a.priority).slice(0, MAX_CANDIDATE_INTENTS);
    }
    const intents = [
        ...planWorkIntents(runtime),
        ...planExplorationIntents(runtime),
        ...planSocialIntents(runtime),
        ...planQuietReflectionIntents(runtime),
        ...planOutreachIntents(runtime),
    ];
    return intents
        .filter((intent) => runtime.rhythmWindow.allowedIntentKinds.includes(intent.kind))
        .sort((a, b) => b.priority - a.priority)
        .slice(0, MAX_CANDIDATE_INTENTS);
}
/** @deprecated Continuity-only helper for tests; prefer `planCandidateIntents` + `buildHeartbeatRuntimeSnapshot`. */
export function planIntent(snapshot) {
    const inputs = {
        mode: snapshot.mode,
        currentWindowId: snapshot.currentWindowId,
        pendingObligations: snapshot.pendingObligations,
        recentOutreachHashes: snapshot.recentOutreachHashes,
        deniedIntents: snapshot.deniedIntents,
        budgets: snapshot.budgets,
        awaitingUserInput: snapshot.awaitingUserInput,
        riskSuppressed: snapshot.riskSuppressed,
        quietEnabledBridge: snapshot.mode === "quiet",
    };
    const runtime = buildHeartbeatRuntimeSnapshot("2026-03-25T12:00:00.000Z", inputs, snapshot);
    return planCandidateIntents(runtime);
}
export function decideDecisionBasis(intent) {
    if (intent.source === "obligation")
        return "rule_only";
    if (intent.effectClass === "maintenance" || intent.effectClass === "no_effect")
        return "rule_only";
    if (intent.kind === "outreach" || intent.kind === "reflection")
        return "model_assisted";
    if (intent.kind === "exploration" || intent.kind === "social" || intent.kind === "work")
        return "score_based";
    return "rule_only";
}
