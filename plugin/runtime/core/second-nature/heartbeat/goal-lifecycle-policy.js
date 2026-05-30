export function createGoalLifecyclePolicy() {
    return {
        evaluate(goals) {
            const now = new Date().toISOString();
            const activeGoals = [];
            const transitionRequests = [];
            // Group by kind+scope to detect duplicates among accepted goals
            const groups = new Map();
            for (const goal of goals) {
                if (goal.status !== "accepted")
                    continue;
                const key = `${goal.kind}:${goal.scope ?? "global"}`;
                const list = groups.get(key) ?? [];
                list.push(goal);
                groups.set(key, list);
            }
            for (const [key, list] of groups) {
                // Sort by updatedAt desc, keep newest as active
                const sorted = [...list].sort((a, b) => {
                    const aTime = new Date(a.updatedAt ?? 0).getTime();
                    const bTime = new Date(b.updatedAt ?? 0).getTime();
                    if (isNaN(aTime) || isNaN(bTime))
                        return 0;
                    return bTime - aTime;
                });
                const [newest, ...older] = sorted;
                if (newest) {
                    activeGoals.push(newest);
                    // Older same kind+scope goals → replace
                    for (const old of older) {
                        transitionRequests.push({
                            goalId: old.goalId,
                            newStatus: "replaced",
                            reason: `same_kind_scope_replace:${key}`,
                            updatedAt: now,
                        });
                    }
                }
            }
            // Detect expired goals among active
            for (const goal of activeGoals) {
                if (goal.expiresAt) {
                    const expiresTime = new Date(goal.expiresAt).getTime();
                    if (!isNaN(expiresTime) && expiresTime < new Date(now).getTime()) {
                        transitionRequests.push({
                            goalId: goal.goalId,
                            newStatus: "expired",
                            reason: "expires_at_reached",
                            updatedAt: now,
                        });
                    }
                }
            }
            return {
                activeGoals,
                transitionRequests,
                evaluatedAt: now,
            };
        },
    };
}
