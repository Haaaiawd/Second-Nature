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
// Per-slice timeout budgets (T2.2.3).
// Critical slices get the full hard deadline; non-critical slices get a shorter
// budget so a hanging non-critical read port cannot consume the whole heartbeat.
const CRITICAL_SLICE_TIMEOUT_MS = 1500;
const NON_CRITICAL_SLICE_TIMEOUT_MS = 600;
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
    const { statePort, affordanceAssembler, selfHealthProvider, continuityReadPort, characterLoader, activityThreadPort, stageEventSink, options = {}, } = deps;
    const interactionLimit = options.interactionLimit ?? INTERACTION_LIMIT;
    const experienceLimit = options.experienceLimit ?? TOOL_EXPERIENCE_LIMIT;
    const acceptedDreamLimit = options.acceptedDreamLimit ?? ACCEPTED_DREAM_PROJECTION_LIMIT;
    const activityThreadLimit = options.activityThreadLimit ?? ACTIVE_ACTIVITY_THREAD_LIMIT;
    const hardDeadlineMs = options.hardDeadlineMs ?? EMBODIED_CONTEXT_HARD_DEADLINE_MS;
    const criticalTimeout = options.criticalSliceTimeoutMs ?? CRITICAL_SLICE_TIMEOUT_MS;
    const nonCriticalTimeout = options.nonCriticalSliceTimeoutMs ?? NON_CRITICAL_SLICE_TIMEOUT_MS;
    return {
        async assembleEmbodiedContext() {
            const assembledAt = new Date().toISOString();
            const startTime = Date.now();
            // ── Parallel slice loading with per-slice timeouts (T2.2.3) ──
            // Critical slices (identity, goals, affordanceMap) get the full critical budget.
            // Non-critical slices (continuity, character, projections, routines, threads, health,
            //   dream, interactions, experience) get a shorter budget so a hanging non-critical
            //   read port cannot consume the whole heartbeat.
            const sliceNames = [
                "identity",
                "goals",
                "recentInteractions",
                "toolExperience",
                "acceptedDream",
                "affordanceMap",
                "selfHealth",
                "selfContinuityCard",
                "characterFrame",
                "activeMemoryProjections",
                "activeProceduralProjections",
                "routineList",
                "activityThreads",
            ];
            const sliceLoaders = {
                identity: async () => {
                    const r = await statePort.loadIdentityProfile("default");
                    return r.status === "loaded"
                        ? { status: "loaded", data: r.data }
                        : r.status === "degraded" && r.data
                            ? { status: "degraded", data: r.data, reason: r.reason }
                            : { status: "degraded", data: {}, reason: r.reason };
                },
                goals: async () => {
                    const r = await statePort.listActiveGoals(10);
                    return r.status === "loaded"
                        ? { status: "loaded", data: r.data }
                        : { status: "degraded", data: [], reason: r.reason };
                },
                recentInteractions: async () => {
                    const r = await statePort.loadRecentInteractionSnapshot(interactionLimit);
                    return r.status === "loaded"
                        ? { status: "loaded", data: trimLifo(r.data, interactionLimit) }
                        : { status: "degraded", data: [], reason: r.reason };
                },
                toolExperience: async () => {
                    const r = await statePort.loadToolExperienceSlice(experienceLimit);
                    return r.status === "loaded"
                        ? { status: "loaded", data: trimLifo(r.data, experienceLimit) }
                        : { status: "degraded", data: [], reason: r.reason };
                },
                acceptedDream: async () => {
                    const r = await statePort.loadAcceptedDreamProjection(acceptedDreamLimit);
                    return r.status === "loaded"
                        ? { status: "loaded", data: r.data.map(mapDreamOutputToMemoryProjection) }
                        : { status: "degraded", data: [], reason: r.reason };
                },
                affordanceMap: async () => {
                    try {
                        const map = await affordanceAssembler.assembleAffordanceMap();
                        return { status: "loaded", data: map };
                    }
                    catch (err) {
                        return {
                            status: "degraded",
                            data: {},
                            reason: `affordance_assembly_failed:${err instanceof Error ? err.message : String(err)}`,
                        };
                    }
                },
                selfHealth: async () => {
                    if (!selfHealthProvider) {
                        return {
                            status: "degraded",
                            data: { snapshotId: "unavailable", dimensions: {}, checkedAt: assembledAt },
                            reason: "self_health_provider_unavailable",
                        };
                    }
                    try {
                        const r = await selfHealthProvider.loadSelfHealth();
                        return r.status === "loaded"
                            ? { status: "loaded", data: r.data }
                            : {
                                status: "degraded",
                                data: { snapshotId: "degraded", dimensions: {}, checkedAt: assembledAt },
                                reason: r.reason,
                            };
                    }
                    catch (err) {
                        return {
                            status: "degraded",
                            data: { snapshotId: "degraded", dimensions: {}, checkedAt: assembledAt },
                            reason: `self_health_unavailable:${err instanceof Error ? err.message : String(err)}`,
                        };
                    }
                },
                selfContinuityCard: async () => {
                    const cardOrDegraded = await continuityReadPort.loadSelfContinuityCard({
                        workspaceRoot: "",
                        now: assembledAt,
                    });
                    if (isDegradedOperationResult(cardOrDegraded)) {
                        return { status: "degraded", data: {}, reason: cardOrDegraded.reason };
                    }
                    return { status: "loaded", data: cardOrDegraded };
                },
                characterFrame: async () => {
                    const result = await characterLoader.loadActiveCharacterFrame({
                        workspaceRoot: "",
                        now: assembledAt,
                    });
                    if (result.degraded || !result.pointer || !result.projection) {
                        const reason = result.degraded?.reason ?? "character_frame_deferred";
                        return {
                            status: "degraded",
                            data: {
                                pointer: {
                                    frameId: "deferred",
                                    summary: "character frame deferred",
                                    contestPrompt: "",
                                    sourceRefs: [],
                                    status: "deferred",
                                },
                                projection: {
                                    frameId: "deferred",
                                    text: "character frame deferred",
                                    contestPrompt: "",
                                    sourceRefs: [],
                                    status: "deferred",
                                },
                                reason,
                            },
                            reason,
                        };
                    }
                    return {
                        status: "loaded",
                        data: { pointer: result.pointer, projection: result.projection },
                    };
                },
                activeMemoryProjections: async () => {
                    const r = await continuityReadPort.loadActiveMemoryProjections({
                        workspaceRoot: "",
                        now: assembledAt,
                    });
                    if (r.degraded) {
                        return { status: "degraded", data: [], reason: r.degraded.reason };
                    }
                    return { status: "loaded", data: r.projections };
                },
                activeProceduralProjections: async () => {
                    const r = await continuityReadPort.loadActiveProceduralProjections({
                        workspaceRoot: "",
                        now: assembledAt,
                    });
                    if (r.degraded) {
                        return { status: "degraded", data: [], reason: r.degraded.reason };
                    }
                    return { status: "loaded", data: r.projections };
                },
                routineList: async () => {
                    const r = await continuityReadPort.loadRoutineList({
                        workspaceRoot: "",
                        status: ["installed"],
                    });
                    if (r.degraded) {
                        return { status: "degraded", data: [], reason: r.degraded.reason };
                    }
                    return { status: "loaded", data: r.routines };
                },
                activityThreads: async () => {
                    const r = await activityThreadPort.loadActivityThreads({
                        workspaceRoot: "",
                        status: ["active", "paused"],
                        limit: activityThreadLimit,
                    });
                    if (r.status === "degraded") {
                        return { status: "degraded", data: [], reason: r.reason };
                    }
                    if (r.status === "blocked") {
                        return { status: "blocked", data: [], reason: r.reason };
                    }
                    return { status: "loaded", data: r.data };
                },
            };
            // Per-slice timeout budget assignment.
            // Critical: identity, goals, affordanceMap → criticalTimeout
            // Non-critical: everything else → nonCriticalTimeout
            const criticalSlices = new Set(["identity", "goals", "affordanceMap"]);
            const sliceTimeouts = {};
            for (const name of sliceNames) {
                sliceTimeouts[name] = criticalSlices.has(name) ? criticalTimeout : nonCriticalTimeout;
            }
            // Launch all slices in parallel with individual timeouts.
            const slicePromises = sliceNames.map(async (name) => {
                const sliceStart = Date.now();
                try {
                    const result = await withTimeout(sliceLoaders[name](), sliceTimeouts[name]);
                    return { name, result, durationMs: Date.now() - sliceStart, timedOut: false };
                }
                catch (err) {
                    return {
                        name,
                        result: {
                            status: "degraded",
                            data: {},
                            reason: err instanceof Error && err.message === "slice_timeout"
                                ? "slice_timeout"
                                : err instanceof Error ? err.message : String(err),
                        },
                        durationMs: Date.now() - sliceStart,
                        timedOut: err instanceof Error && err.message === "slice_timeout",
                    };
                }
            });
            const results = await Promise.all(slicePromises);
            const totalDurationMs = Date.now() - startTime;
            // Build slice map.
            const sliceMap = {};
            const sliceTimings = {};
            const degradedSlices = [];
            const timedOutSlices = [];
            for (const r of results) {
                sliceMap[r.name] = r.result;
                sliceTimings[r.name] = r.durationMs;
                if (r.result.status === "degraded" || r.result.status === "blocked") {
                    degradedSlices.push(r.name);
                }
                if (r.timedOut) {
                    timedOutSlices.push(r.name);
                }
            }
            // Emit latency stage event if sink is provided.
            if (stageEventSink) {
                stageEventSink.recordContextAssemblyLatency({
                    totalDurationMs,
                    hardDeadlineMs,
                    withinDeadline: totalDurationMs <= hardDeadlineMs,
                    sliceTimings,
                    degradedSlices,
                    timedOutSlices,
                });
            }
            // Unpack character frame composite slice.
            const charFrameData = sliceMap.characterFrame.data;
            return {
                identity: sliceMap.identity,
                goals: sliceMap.goals,
                recentInteractions: sliceMap.recentInteractions,
                toolExperience: sliceMap.toolExperience,
                acceptedDream: sliceMap.acceptedDream,
                affordanceMap: sliceMap.affordanceMap,
                selfHealth: sliceMap.selfHealth,
                selfContinuityCard: sliceMap.selfContinuityCard,
                characterFramePointer: {
                    status: sliceMap.characterFrame.status,
                    data: charFrameData.pointer,
                    reason: sliceMap.characterFrame.reason,
                },
                characterFrameProjection: {
                    status: sliceMap.characterFrame.status,
                    data: charFrameData.projection,
                    reason: sliceMap.characterFrame.reason,
                },
                activeMemoryProjections: sliceMap.activeMemoryProjections,
                activeProceduralProjections: sliceMap.activeProceduralProjections,
                routineList: sliceMap.routineList,
                activityThreads: sliceMap.activityThreads,
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
        stageEventSink: deps.stageEventSink,
    });
}
