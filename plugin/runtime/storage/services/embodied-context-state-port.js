/**
 * EmbodiedContextStatePort — T-SMS.C.2
 *
 * Core logic: 5 read methods for assembling EmbodiedContext slices.
 * Each method supports bounded query (limit/window).
 * Affordance and self-health slices are sourced from body-tool-system
 * and observability-health-system respectively, NOT read directly here.
 * DR-011: loadAcceptedDreamProjection returns accepted projection only.
 * DR-013: bounded context, degraded reason codes on failure.
 * DR-024: empty accepted dream → context_degraded:dream_projection_unavailable.
 *
 * Dependencies:
 * - GoalLifecycleStore from `./goal-lifecycle-store.js`
 * - IdentityProfileStore from `./identity-profile-store.js`
 * - InteractionSnapshotProjector from `./interaction-snapshot-projector.js`
 * - ToolExperienceStore from `./tool-experience-store.js`
 * - dream_output_index table (v7-001 migration)
 *
 * Boundary:
 * - This port ONLY reads state-memory tables.
 * - Affordance map and self-health are injected by caller (control-plane)
 *   from their respective systems.
 * - All methods return empty array + reason on missing data, never throw.
 */
export function createEmbodiedContextStatePort(deps) {
    const { database, goalStore, identityStore, interactionProjector, experienceStore } = deps;
    return {
        async loadIdentityProfile(profileId) {
            const result = await identityStore.loadIdentityProfile(profileId);
            if (result.status === "not_found") {
                return { status: "degraded", reason: `identity_profile_degraded:${profileId}` };
            }
            if (result.status === "degraded") {
                return {
                    status: "degraded",
                    data: result.profile,
                    reason: `identity_profile_degraded:${result.missingPlatforms.join(",")}`,
                };
            }
            return { status: "loaded", data: result.profile };
        },
        async listActiveGoals(limit = 10) {
            try {
                const goals = await goalStore.listActiveGoals({ limit });
                return { status: "loaded", data: goals };
            }
            catch {
                return { status: "degraded", reason: "goal_store_unavailable" };
            }
        },
        async loadRecentInteractionSnapshot(limit = 10) {
            try {
                const rows = await interactionProjector.loadRecentInteractionSnapshot(limit);
                return { status: "loaded", data: rows };
            }
            catch {
                return { status: "degraded", reason: "interaction_store_unavailable" };
            }
        },
        async loadToolExperienceSlice(limit = 10) {
            try {
                const rows = await experienceStore.listToolExperience({ limit });
                return { status: "loaded", data: rows };
            }
            catch {
                return { status: "degraded", reason: "tool_experience_store_unavailable" };
            }
        },
        async loadAcceptedDreamProjection(limit = 3) {
            try {
                const { sqlite } = database;
                const result = sqlite.exec(`SELECT output_id, run_id, status, canonical_entries_json,
                  insights_json, narrative_update_json, relationship_update_json,
                  validation_json, created_at
           FROM dream_output_index
           WHERE status = 'accepted'
           ORDER BY created_at DESC
           LIMIT ${limit}`);
                if (result.length === 0 || result[0].values.length === 0) {
                    return {
                        status: "degraded",
                        reason: "context_degraded:dream_projection_unavailable",
                    };
                }
                const cols = result[0].columns;
                const get = (row, name) => row[cols.indexOf(name)];
                const outputs = result[0].values.map((row) => ({
                    outputId: get(row, "output_id"),
                    runId: get(row, "run_id"),
                    status: "accepted",
                    canonicalEntries: safeParseJson(get(row, "canonical_entries_json") ?? "[]", []),
                    insights: safeParseJson(get(row, "insights_json") ?? "[]", []),
                    narrativeUpdate: safeParseJson(get(row, "narrative_update_json") ?? "null", undefined),
                    relationshipUpdate: safeParseJson(get(row, "relationship_update_json") ?? "null", undefined),
                    validation: safeParseJson(get(row, "validation_json") ?? "{}", {
                        schemaValid: false, sourceGrounded: false, sensitivityClean: false,
                        unsupportedClaims: [], errors: [], checkedAt: "",
                    }),
                }));
                return { status: "loaded", data: outputs };
            }
            catch {
                return { status: "degraded", reason: "dream_output_store_unavailable" };
            }
        },
    };
}
function safeParseJson(json, fallback) {
    try {
        return JSON.parse(json);
    }
    catch {
        return fallback;
    }
}
