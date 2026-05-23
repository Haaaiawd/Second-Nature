const QUIET_DENY_KINDS = ["outreach", "social"];
export function evaluateHardGuards(intent, deps) {
    const reasons = [];
    // 1. Source refs guard
    if (intent.sourceRefs.length === 0 &&
        intent.effectClass !== "maintenance" &&
        intent.effectClass !== "no_effect") {
        reasons.push("missing_source_refs");
    }
    // 2. Affordance / breaker guard (v7)
    if ((intent.effectClass === "connector_action" ||
        intent.effectClass === "external_platform_action") &&
        deps.affordanceMap &&
        intent.platformId) {
        const platformItems = deps.affordanceMap[intent.platformId] ?? [];
        const match = intent.capabilityIntent
            ? platformItems.find((i) => i.capabilityId === intent.capabilityIntent)
            : platformItems.find((i) => i.intent === intent.summary);
        if (match) {
            if (match.status === "painful") {
                reasons.push("connector_circuit_open");
            }
            else if (match.status === "unavailable") {
                reasons.push("affordance_unavailable");
            }
        }
        else {
            reasons.push("affordance_unavailable");
        }
    }
    // 3. Dedupe guard
    const key = intent.idempotencyKey ?? `${intent.kind}:${intent.summary}`;
    if (deps.hasDuplicateIntent(key)) {
        reasons.push("duplicate_intent");
    }
    // 4. Outreach cooldown
    if (intent.effectClass === "user_outreach" &&
        !deps.isOutreachCooldownClear(key)) {
        reasons.push("outreach_cooldown");
    }
    // 5. Quiet suppression
    if (deps.quietBias) {
        if (QUIET_DENY_KINDS.includes(intent.kind)) {
            reasons.push("quiet_window_suppression");
        }
        if (intent.effectClass === "connector_action" ||
            intent.effectClass === "external_platform_action") {
            reasons.push("quiet_window_suppression");
        }
    }
    // 6. Budget
    if (deps.budgetExceeded) {
        reasons.push("budget_exceeded");
    }
    // 7. Awaiting user
    if (deps.awaitingUser) {
        reasons.push("awaiting_user");
    }
    // 8. Risk
    if (deps.riskSuppressed) {
        if (intent.kind === "exploration" ||
            intent.kind === "social" ||
            intent.kind === "outreach") {
            reasons.push("risk_suppressed");
        }
    }
    // Verdict resolution
    if (reasons.length === 0) {
        return {
            verdict: "allow",
            reasons: [],
            quietSuppressed: false,
            leaseRequired: intent.effectClass === "external_platform_action" ||
                intent.effectClass === "connector_action" ||
                intent.effectClass === "user_outreach",
            requiresCheckpoint: intent.effectClass !== "maintenance" &&
                intent.effectClass !== "no_effect",
        };
    }
    const deferOnlyReasons = reasons.every((r) => r === "duplicate_intent" ||
        r === "outreach_cooldown" ||
        r === "connector_circuit_open" ||
        r === "quiet_window_suppression" ||
        r === "affordance_unavailable");
    if (deferOnlyReasons) {
        return {
            verdict: "defer",
            reasons,
            quietSuppressed: reasons.includes("quiet_window_suppression"),
            leaseRequired: false,
            requiresCheckpoint: false,
        };
    }
    const escalated = reasons.includes("awaiting_user") && intent.kind === "outreach";
    return {
        verdict: escalated ? "escalate" : "deny",
        reasons,
        quietSuppressed: reasons.includes("quiet_window_suppression"),
        leaseRequired: false,
        requiresCheckpoint: false,
    };
}
