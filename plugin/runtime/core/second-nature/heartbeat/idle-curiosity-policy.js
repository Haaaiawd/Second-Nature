const IDLE_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
function isReadOnlyIntent(intent) {
    return (intent.endsWith(".read") ||
        intent.endsWith(".discover") ||
        intent.endsWith(".inspect") ||
        intent.endsWith(".search"));
}
export function createIdleCuriosityPolicy() {
    return {
        select(affordanceMap, recentIdleHistory) {
            const now = Date.now();
            // Build eligible list
            const eligible = [];
            for (const [platformId, items] of Object.entries(affordanceMap)) {
                for (const item of items) {
                    // Read-only only
                    if (!isReadOnlyIntent(item.intent))
                        continue;
                    // Healthy status only
                    if (item.status !== "safe" && item.status !== "exploratory")
                        continue;
                    // Check cooldown
                    const lastIdle = recentIdleHistory
                        .filter((h) => h.platformId === platformId)
                        .sort((a, b) => {
                        const aTime = new Date(a.at).getTime();
                        const bTime = new Date(b.at).getTime();
                        if (isNaN(aTime) || isNaN(bTime))
                            return 0;
                        return bTime - aTime;
                    })[0];
                    if (lastIdle) {
                        const lastTime = new Date(lastIdle.at).getTime();
                        if (!isNaN(lastTime)) {
                            const elapsed = now - lastTime;
                            if (elapsed < IDLE_COOLDOWN_MS)
                                continue;
                        }
                    }
                    eligible.push(item);
                }
            }
            if (eligible.length === 0) {
                return { reason: "idle_policy_no_eligible_connector" };
            }
            // Deterministic selection: first eligible by stable sort
            const chosen = eligible.sort((a, b) => a.platformId.localeCompare(b.platformId) ||
                a.capabilityId.localeCompare(b.capabilityId))[0];
            return {
                candidate: {
                    platformId: chosen.platformId,
                    capabilityId: chosen.capabilityId,
                    intent: chosen.intent,
                    reason: "idle_sensing_selected",
                },
                reason: "idle_sensing_selected",
            };
        },
    };
}
