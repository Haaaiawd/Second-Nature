const MAX_CANDIDATES = 6;
function planObligationIntents(snapshot) {
    return snapshot.pendingObligations.map((obligation, index) => ({
        id: `intent-obligation-${index}`,
        kind: "work",
        priority: 100 - index,
        source: "obligation",
        summary: `fulfill obligation: ${obligation}`,
        effectClass: "external_platform_action",
    }));
}
function planPlatformIntents(snapshot) {
    const socialPriorityBase = snapshot.budgets && snapshot.budgets.socialUsed >= snapshot.budgets.socialLimit ? 10 : 60;
    return [
        {
            id: "intent-exploration",
            kind: "exploration",
            priority: 70,
            source: "tick",
            summary: "scan platform opportunities",
            effectClass: "external_platform_action",
        },
        {
            id: "intent-social",
            kind: "social",
            priority: socialPriorityBase,
            source: "tick",
            summary: "engage social platforms",
            effectClass: "external_platform_action",
        },
    ];
}
function planQuietIntents(snapshot) {
    if (snapshot.mode !== "quiet") {
        return [];
    }
    return [
        {
            id: "intent-maintenance",
            kind: "maintenance",
            priority: 90,
            source: "quiet_plan",
            summary: "run maintenance checks",
            effectClass: "maintenance",
        },
        {
            id: "intent-reflection",
            kind: "reflection",
            priority: 80,
            source: "quiet_plan",
            summary: "run narrative reflection",
            effectClass: "narrative_reflection",
        },
    ];
}
function planOutreachIntents(snapshot) {
    if (snapshot.recentOutreachHashes.length > 3) {
        return [];
    }
    return [
        {
            id: "intent-outreach",
            kind: "outreach",
            priority: 40,
            source: "tick",
            summary: "consider proactive user outreach",
            effectClass: "user_outreach",
        },
    ];
}
export function planIntent(snapshot) {
    if (snapshot.mode === "maintenance_only") {
        return planObligationIntents(snapshot);
    }
    const intents = [
        ...planObligationIntents(snapshot),
        ...planPlatformIntents(snapshot),
        ...planQuietIntents(snapshot),
        ...planOutreachIntents(snapshot),
    ];
    return intents
        .sort((a, b) => b.priority - a.priority)
        .slice(0, MAX_CANDIDATES);
}
export function decideDecisionBasis(intent) {
    if (intent.source === "obligation")
        return "rule_only";
    if (intent.kind === "maintenance")
        return "rule_only";
    if (intent.kind === "outreach" || intent.kind === "reflection")
        return "model_assisted";
    if (intent.kind === "exploration" || intent.kind === "social" || intent.kind === "work")
        return "score_based";
    return "rule_only";
}
