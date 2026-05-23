/**
 * EmbodiedContextAssembler — T-CP.C.1
 *
 * Core logic: Assembles a complete EmbodiedContext from up to 7 read ports:
 * - 5 state-memory slices via EmbodiedContextStatePort
 * - affordanceMap via AffordanceAssembler
 * - selfHealth via SelfHealthProvider (observability hook)
 *
 * Trim policies (DR-020):
 * - recentInteractions: LIFO 10
 * - toolExperience: LIFO 10
 * - sourceRefs: deduplicated to 20 per slice
 *
 * Performance: P95 < 400ms for full assembly (DR-016).
 *
 * Dependencies:
 * - `EmbodiedContextStatePort` from `../../../storage/services/embodied-context-state-port.js`
 * - `AffordanceAssembler` from `../body/tool-affordance/affordance-assembler.js`
 * - `EmbodiedContext` from `../../../shared/types/v7-entities.js`
 *
 * Boundary:
 * - Candidate dream outputs are NOT included (DR-011).
 * - Each slice gets its own loaded/degraded/blocked status.
 * - Does NOT throw on partial failure; assembles best-effort context.
 *
 * Test coverage: tests/unit/control-plane/embodied-context-assembler.test.ts
 */
function trimLifo(arr, limit) {
    if (arr.length <= limit)
        return arr;
    return arr.slice(-limit);
}
function dedupSourceRefs(items, limit) {
    const seen = new Set();
    const result = [];
    for (const item of items) {
        if (item.sourceRefs && item.sourceRefs.length > 0) {
            const key = item.sourceRefs.join("|");
            if (seen.has(key))
                continue;
            if (seen.size >= limit)
                break;
            seen.add(key);
        }
        result.push(item);
    }
    return result;
}
export function createEmbodiedContextAssembler(deps) {
    const { statePort, affordanceAssembler, selfHealthProvider, options = {}, } = deps;
    const interactionLimit = options.interactionLimit ?? 10;
    const experienceLimit = options.experienceLimit ?? 10;
    const profileId = options.profileId ?? "default";
    return {
        async assembleEmbodiedContext() {
            const assembledAt = new Date().toISOString();
            // ── 1. Identity ───────────────────────────────────────────
            const identityResult = await statePort.loadIdentityProfile(profileId);
            const identitySlice = identityResult.status === "loaded"
                ? { status: "loaded", data: identityResult.data }
                : identityResult.status === "degraded" && identityResult.data
                    ? {
                        status: "degraded",
                        data: identityResult.data,
                        reason: identityResult.reason,
                    }
                    : {
                        status: "degraded",
                        data: {},
                        reason: identityResult.reason,
                    };
            // ── 2. Goals ──────────────────────────────────────────────
            const goalsResult = await statePort.listActiveGoals(10);
            const goalsSlice = goalsResult.status === "loaded"
                ? { status: "loaded", data: goalsResult.data }
                : { status: "degraded", data: [], reason: goalsResult.reason };
            // ── 3. Recent Interactions (trim LIFO) ────────────────────
            const interactionResult = await statePort.loadRecentInteractionSnapshot(interactionLimit);
            const recentInteractionsSlice = interactionResult.status === "loaded"
                ? {
                    status: "loaded",
                    data: trimLifo(interactionResult.data, interactionLimit),
                }
                : {
                    status: "degraded",
                    data: [],
                    reason: interactionResult.reason,
                };
            // ── 4. Tool Experience (trim LIFO) ────────────────────────
            const experienceResult = await statePort.loadToolExperienceSlice(experienceLimit);
            const toolExperienceSlice = experienceResult.status === "loaded"
                ? {
                    status: "loaded",
                    data: trimLifo(experienceResult.data, experienceLimit),
                }
                : {
                    status: "degraded",
                    data: [],
                    reason: experienceResult.reason,
                };
            // ── 5. Accepted Dream ─────────────────────────────────────
            const dreamResult = await statePort.loadAcceptedDreamProjection(3);
            const acceptedDreamSlice = dreamResult.status === "loaded"
                ? { status: "loaded", data: dreamResult.data }
                : { status: "degraded", data: [], reason: dreamResult.reason };
            // ── 6. Affordance Map ─────────────────────────────────────
            let affordanceMapSlice;
            try {
                const affordanceMap = await affordanceAssembler.assembleAffordanceMap();
                affordanceMapSlice = {
                    status: "loaded",
                    data: affordanceMap,
                };
            }
            catch (err) {
                affordanceMapSlice = {
                    status: "degraded",
                    data: {},
                    reason: `affordance_assembly_failed:${err instanceof Error ? err.message : String(err)}`,
                };
            }
            // ── 7. Self Health (optional) ─────────────────────────────
            let selfHealthSlice;
            if (selfHealthProvider) {
                try {
                    const healthResult = await selfHealthProvider.loadSelfHealth();
                    selfHealthSlice =
                        healthResult.status === "loaded"
                            ? { status: "loaded", data: healthResult.data }
                            : {
                                status: "degraded",
                                data: {
                                    snapshotId: "degraded",
                                    dimensions: {},
                                    checkedAt: assembledAt,
                                },
                                reason: healthResult.reason,
                            };
                }
                catch (err) {
                    selfHealthSlice = {
                        status: "degraded",
                        data: {
                            snapshotId: "degraded",
                            dimensions: {},
                            checkedAt: assembledAt,
                        },
                        reason: `self_health_unavailable:${err instanceof Error ? err.message : String(err)}`,
                    };
                }
            }
            return {
                identity: identitySlice,
                goals: goalsSlice,
                recentInteractions: recentInteractionsSlice,
                toolExperience: toolExperienceSlice,
                acceptedDream: acceptedDreamSlice,
                affordanceMap: affordanceMapSlice,
                selfHealth: selfHealthSlice,
                assembledAt,
            };
        },
    };
}
