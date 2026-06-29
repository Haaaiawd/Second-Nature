/**
 * V9EmbodiedContextAssembler — T2.2.1
 *
 * Core logic: Assemble a complete v9 EmbodiedContext from:
 * - v8 state-memory slices (identity, goals, recentInteractions, toolExperience, acceptedDream)
 * - affordanceMap via AffordanceAssembler
 * - selfHealth via SelfHealthProvider
 * - v9 continuity slices (selfContinuityCard, activeMemoryProjections, activeProceduralProjections, routineList)
 * - character slices (characterFramePointer, characterFrameProjection)
 * - activityThreads via ActivityThreadPort
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/control-context-system.md §5.1`
 * - `.anws/v9/04_SYSTEM_DESIGN/control-context-system.detail.md §2 §3.3 §3.5`
 * - `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md §10`
 * - ADR-006: Character Continuity as Emergent Projection
 *
 * Dependencies:
 * - `src/storage/services/embodied-context-state-port.js`
 * - `src/core/second-nature/body/tool-affordance/affordance-assembler.js`
 * - `src/core/second-nature/memory/self-continuity-card-assembler.js`
 * - `src/core/second-nature/character/character-frame-lifecycle.js`
 * - `src/storage/v9-state-stores.js`
 * - `src/shared/types/v9-contracts.js`
 *
 * Boundary:
 * - Each slice gets its own loaded/degraded/blocked status.
 * - Does NOT throw on partial failure; assembles best-effort context.
 * - CharacterFrame projection is contestable; pointer and projection are loaded separately.
 * - Activity threads are loaded for active and paused statuses.
 * - acceptedDream is mapped from v7 DreamOutput[] to v9 MemoryProjection[].
 *
 * Test coverage:
 * - `tests/unit/control-plane/v9-embodied-context.test.ts`
 * - `tests/integration/v9/context-continuity-injection.test.ts`
 */
import { buildEmbodiedContextProjection, buildCharacterFramePointer, loadActiveCharacterFrame, } from "../character/character-frame-lifecycle.js";
import { createCharacterFrameStoreAdapter } from "../memory/self-continuity-card-assembler.js";
import { readActivityThreadById, readActivityThreadsByStatus, updateActivityThreadProgress, writeActivityStep, writeActivityThread, } from "../../../storage/v9-state-stores.js";
// ───────────────────────────────────────────────────────────────
// Constants
// ───────────────────────────────────────────────────────────────
const INTERACTION_LIMIT = 10;
const TOOL_EXPERIENCE_LIMIT = 10;
const ACCEPTED_DREAM_PROJECTION_LIMIT = 3;
const ACTIVE_ACTIVITY_THREAD_LIMIT = 3;
const EMBODIED_CONTEXT_HARD_DEADLINE_MS = 1800;
// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────
function trimLifo(arr, limit) {
    if (arr.length <= limit)
        return arr;
    return arr.slice(-limit);
}
function isDegradedOperationResult(value) {
    return !("id" in value);
}
function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("slice_timeout")), ms)),
    ]);
}
function emptyMemoryProjection(id) {
    return {
        id,
        kind: "memory",
        sourceRefs: [{ family: "dream", id }],
    };
}
function mapDreamOutputToMemoryProjection(output) {
    return emptyMemoryProjection(output.outputId ?? "unknown");
}
// ───────────────────────────────────────────────────────────────
// Port factories
// ───────────────────────────────────────────────────────────────
export function createCharacterLoaderPort(db) {
    return {
        async loadActiveCharacterFrame(scope) {
            const store = await createCharacterFrameStoreAdapter(db);
            const result = await loadActiveCharacterFrame(store, {
                now: scope.now,
                isFirstInjection: false,
            });
            if (result.reason && !result.frame) {
                return { degraded: { reason: result.reason, code: "character_frame_deferred" } };
            }
            if (!result.frame) {
                return { degraded: { reason: "No active character frame", code: "character_frame_deferred" } };
            }
            const pointer = result.pointer ?? buildCharacterFramePointer(result.frame);
            const projection = result.projection ?? buildEmbodiedContextProjection(result.frame);
            return { pointer, projection };
        },
    };
}
export function createActivityThreadPort(db) {
    return {
        async loadActivityThreads(options) {
            try {
                const all = [];
                for (const status of options.status) {
                    const rows = await readActivityThreadsByStatus(db, status, {
                        limit: options.limit,
                        orderBy: "desc",
                    });
                    for (const row of rows) {
                        all.push(rowToActivityThread(row));
                    }
                }
                all.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
                const threads = all.slice(0, options.limit);
                return { status: "loaded", data: threads };
            }
            catch (err) {
                return {
                    status: "degraded",
                    data: [],
                    reason: err instanceof Error ? err.message : String(err),
                };
            }
        },
        async createActivityThread(input) {
            try {
                const record = await writeActivityThread(db, {
                    id: input.threadId,
                    originAttentionSignalId: input.originAttentionSignalId,
                    status: input.status,
                    currentFocus: input.currentFocus,
                    associations: input.associations,
                    nextPossibleMoves: input.nextPossibleMoves,
                    completedStepCount: input.completedStepCount,
                    lastStepKind: input.lastStepKind,
                    blockerReason: input.blockerReason,
                    stopCondition: input.stopCondition,
                    lastHeartbeatSequence: input.lastHeartbeatSequence,
                    sourceRefs: input.sourceRefs,
                    createdAt: input.createdAt,
                    updatedAt: input.updatedAt,
                });
                return { status: "loaded", data: rowToActivityThread(record) };
            }
            catch (err) {
                return {
                    status: "degraded",
                    data: {},
                    reason: err instanceof Error ? err.message : String(err),
                };
            }
        },
        async appendActivityStep(input) {
            try {
                const record = await writeActivityStep(db, {
                    id: input.stepId,
                    threadId: input.threadId,
                    cycleId: input.cycleId,
                    stepKind: input.stepKind,
                    summary: input.summary,
                    sourceRefs: input.sourceRefs,
                    closureRef: input.closureRef,
                    createdAt: input.createdAt,
                });
                return { status: "loaded", data: rowToActivityStep(record) };
            }
            catch (err) {
                return {
                    status: "degraded",
                    data: {},
                    reason: err instanceof Error ? err.message : String(err),
                };
            }
        },
        async updateActivityThreadStatus(threadId, status, reason) {
            try {
                await updateActivityThreadProgress(db, threadId, {
                    status,
                    blockerReason: reason,
                    updatedAt: new Date().toISOString(),
                });
                const record = await readActivityThreadById(db, threadId);
                if (!record) {
                    return {
                        status: "degraded",
                        data: {},
                        reason: "Activity thread not found after status update",
                    };
                }
                return { status: "loaded", data: rowToActivityThread(record) };
            }
            catch (err) {
                return {
                    status: "degraded",
                    data: {},
                    reason: err instanceof Error ? err.message : String(err),
                };
            }
        },
        async updateActivityThreadProgress(threadId, patch) {
            try {
                await updateActivityThreadProgress(db, threadId, {
                    status: patch.status,
                    currentFocus: patch.currentFocus,
                    completedStepCount: patch.completedStepCount,
                    lastStepKind: patch.lastStepKind,
                    blockerReason: patch.blockerReason,
                    stopCondition: patch.stopCondition,
                    nextPossibleMovesJson: patch.nextPossibleMoves !== undefined
                        ? JSON.stringify(patch.nextPossibleMoves)
                        : undefined,
                    lastHeartbeatSequence: patch.lastHeartbeatSequence,
                    updatedAt: patch.updatedAt ?? new Date().toISOString(),
                });
                const record = await readActivityThreadById(db, threadId);
                if (!record) {
                    return {
                        status: "degraded",
                        data: {},
                        reason: "Activity thread not found after progress update",
                    };
                }
                return { status: "loaded", data: rowToActivityThread(record) };
            }
            catch (err) {
                return {
                    status: "degraded",
                    data: {},
                    reason: err instanceof Error ? err.message : String(err),
                };
            }
        },
    };
}
function rowToActivityThread(row) {
    return {
        threadId: row.id,
        originAttentionSignalId: row.originAttentionSignalId,
        status: row.status,
        currentFocus: row.currentFocus,
        associations: parseJsonArray(row.associationsJson),
        nextPossibleMoves: parseJsonArray(row.nextPossibleMovesJson),
        completedStepCount: row.completedStepCount,
        lastStepKind: row.lastStepKind,
        blockerReason: row.blockerReason ?? undefined,
        stopCondition: row.stopCondition,
        lastHeartbeatSequence: row.lastHeartbeatSequence,
        sourceRefs: parseSourceRefs(row.sourceRefsJson),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}
function rowToActivityStep(row) {
    return {
        stepId: row.id,
        threadId: row.threadId,
        cycleId: row.cycleId,
        stepKind: row.stepKind,
        summary: row.summary,
        sourceRefs: parseSourceRefs(row.sourceRefsJson),
        closureRef: row.closureRefJson ? parseSourceRef(row.closureRefJson) ?? undefined : undefined,
        createdAt: row.createdAt,
    };
}
function parseSourceRef(json) {
    try {
        return JSON.parse(json);
    }
    catch {
        return undefined;
    }
}
function parseJsonArray(json) {
    if (!json)
        return [];
    try {
        const parsed = JSON.parse(json);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
function parseSourceRefs(json) {
    if (!json)
        return [];
    try {
        const parsed = JSON.parse(json);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
// ───────────────────────────────────────────────────────────────
// Assembler
// ───────────────────────────────────────────────────────────────
export function createV9EmbodiedContextAssembler(deps) {
    const { statePort, affordanceAssembler, selfHealthProvider, continuityReadPort, characterLoader, activityThreadPort, options = {}, } = deps;
    const interactionLimit = options.interactionLimit ?? INTERACTION_LIMIT;
    const experienceLimit = options.experienceLimit ?? TOOL_EXPERIENCE_LIMIT;
    const acceptedDreamLimit = options.acceptedDreamLimit ?? ACCEPTED_DREAM_PROJECTION_LIMIT;
    const activityThreadLimit = options.activityThreadLimit ?? ACTIVE_ACTIVITY_THREAD_LIMIT;
    const hardDeadlineMs = options.hardDeadlineMs ?? EMBODIED_CONTEXT_HARD_DEADLINE_MS;
    return {
        async assembleEmbodiedContext() {
            const assembledAt = new Date().toISOString();
            // ── 1. Identity ───────────────────────────────────────────
            const identityResult = await statePort.loadIdentityProfile("default");
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
            const dreamResult = await statePort.loadAcceptedDreamProjection(acceptedDreamLimit);
            const acceptedDreamSlice = dreamResult.status === "loaded"
                ? {
                    status: "loaded",
                    data: dreamResult.data.map(mapDreamOutputToMemoryProjection),
                }
                : { status: "degraded", data: [], reason: dreamResult.reason };
            // ── 6. Affordance Map ─────────────────────────────────────
            let affordanceMapSlice;
            try {
                const affordanceMap = await affordanceAssembler.assembleAffordanceMap();
                affordanceMapSlice = { status: "loaded", data: affordanceMap };
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
                                data: { snapshotId: "degraded", dimensions: {}, checkedAt: assembledAt },
                                reason: healthResult.reason,
                            };
                }
                catch (err) {
                    selfHealthSlice = {
                        status: "degraded",
                        data: { snapshotId: "degraded", dimensions: {}, checkedAt: assembledAt },
                        reason: `self_health_unavailable:${err instanceof Error ? err.message : String(err)}`,
                    };
                }
            }
            else {
                selfHealthSlice = {
                    status: "degraded",
                    data: { snapshotId: "unavailable", dimensions: {}, checkedAt: assembledAt },
                    reason: "self_health_provider_unavailable",
                };
            }
            // ── 8. Self Continuity Card ───────────────────────────────
            const selfContinuityCardSlice = await loadProjectionSlice(() => continuityReadPort
                .loadSelfContinuityCard({ workspaceRoot: "", now: assembledAt })
                .then((cardOrDegraded) => {
                if (isDegradedOperationResult(cardOrDegraded)) {
                    return {
                        status: "degraded",
                        data: {},
                        reason: cardOrDegraded.reason,
                    };
                }
                return { status: "loaded", data: cardOrDegraded };
            }), hardDeadlineMs);
            // ── 9. Character Frame Pointer / Projection ─────────────
            let characterFramePointerSlice;
            let characterFrameProjectionSlice;
            try {
                const result = await withTimeout(characterLoader.loadActiveCharacterFrame({ workspaceRoot: "", now: assembledAt }), hardDeadlineMs);
                if (result.degraded || !result.pointer || !result.projection) {
                    const reason = result.degraded?.reason ?? "character_frame_deferred";
                    characterFramePointerSlice = {
                        status: "degraded",
                        data: {
                            frameId: "deferred",
                            summary: "character frame deferred",
                            contestPrompt: "",
                            sourceRefs: [],
                            status: "deferred",
                        },
                        reason,
                    };
                    characterFrameProjectionSlice = {
                        status: "degraded",
                        data: {
                            frameId: "deferred",
                            text: "character frame deferred",
                            contestPrompt: "",
                            sourceRefs: [],
                            status: "deferred",
                        },
                        reason,
                    };
                }
                else {
                    characterFramePointerSlice = { status: "loaded", data: result.pointer };
                    characterFrameProjectionSlice = { status: "loaded", data: result.projection };
                }
            }
            catch (err) {
                const reason = err instanceof Error ? err.message : String(err);
                characterFramePointerSlice = {
                    status: "degraded",
                    data: {
                        frameId: "deferred",
                        summary: "character frame deferred",
                        contestPrompt: "",
                        sourceRefs: [],
                        status: "deferred",
                    },
                    reason,
                };
                characterFrameProjectionSlice = {
                    status: "degraded",
                    data: {
                        frameId: "deferred",
                        text: "character frame deferred",
                        contestPrompt: "",
                        sourceRefs: [],
                        status: "deferred",
                    },
                    reason,
                };
            }
            // ── 11. Active Memory Projections ─────────────────────────
            const activeMemoryProjectionsSlice = await loadProjectionSlice(() => continuityReadPort
                .loadActiveMemoryProjections({ workspaceRoot: "", now: assembledAt })
                .then((result) => {
                if (result.degraded) {
                    return {
                        status: "degraded",
                        data: [],
                        reason: result.degraded.reason,
                    };
                }
                return { status: "loaded", data: result.projections };
            }), hardDeadlineMs);
            // ── 12. Active Procedural Projections ─────────────────────
            const activeProceduralProjectionsSlice = await loadProjectionSlice(() => continuityReadPort
                .loadActiveProceduralProjections({ workspaceRoot: "", now: assembledAt })
                .then((result) => {
                if (result.degraded) {
                    return {
                        status: "degraded",
                        data: [],
                        reason: result.degraded.reason,
                    };
                }
                return { status: "loaded", data: result.projections };
            }), hardDeadlineMs);
            // ── 13. Routine List ──────────────────────────────────────
            const routineListSlice = await loadProjectionSlice(() => continuityReadPort
                .loadRoutineList({ workspaceRoot: "", status: ["installed"] })
                .then((result) => {
                if (result.degraded) {
                    return {
                        status: "degraded",
                        data: [],
                        reason: result.degraded.reason,
                    };
                }
                return { status: "loaded", data: result.routines };
            }), hardDeadlineMs);
            // ── 14. Activity Threads ──────────────────────────────────
            const activityThreadsSlice = await loadProjectionSlice(() => activityThreadPort
                .loadActivityThreads({
                workspaceRoot: "",
                status: ["active", "paused"],
                limit: activityThreadLimit,
            })
                .then((result) => {
                if (result.status === "degraded") {
                    return {
                        status: "degraded",
                        data: [],
                        reason: result.reason,
                    };
                }
                if (result.status === "blocked") {
                    return {
                        status: "blocked",
                        data: [],
                        reason: result.reason,
                    };
                }
                return { status: "loaded", data: result.data };
            }), hardDeadlineMs);
            return {
                identity: identitySlice,
                goals: goalsSlice,
                recentInteractions: recentInteractionsSlice,
                toolExperience: toolExperienceSlice,
                acceptedDream: acceptedDreamSlice,
                affordanceMap: affordanceMapSlice,
                selfHealth: selfHealthSlice,
                selfContinuityCard: selfContinuityCardSlice,
                characterFramePointer: characterFramePointerSlice,
                characterFrameProjection: characterFrameProjectionSlice,
                activeMemoryProjections: activeMemoryProjectionsSlice,
                activeProceduralProjections: activeProceduralProjectionsSlice,
                routineList: routineListSlice,
                activityThreads: activityThreadsSlice,
                assembledAt,
            };
        },
    };
}
async function loadProjectionSlice(loader, timeoutMs) {
    try {
        return await withTimeout(loader(), timeoutMs);
    }
    catch (err) {
        return {
            status: "degraded",
            data: {},
            reason: err instanceof Error ? err.message : String(err),
        };
    }
}
export function createV9EmbodiedContextAssemblerFromDeps(deps) {
    const characterLoader = createCharacterLoaderPort(deps.db);
    const activityThreadPort = createActivityThreadPort(deps.db);
    return createV9EmbodiedContextAssembler({
        statePort: deps.statePort,
        affordanceAssembler: deps.affordanceAssembler,
        selfHealthProvider: deps.selfHealthProvider,
        continuityReadPort: deps.continuityReadPort,
        characterLoader,
        activityThreadPort,
    });
}
