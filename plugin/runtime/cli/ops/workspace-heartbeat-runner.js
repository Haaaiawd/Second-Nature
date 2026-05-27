import { runHeartbeatCycle } from "../../core/second-nature/heartbeat/run-heartbeat-cycle.js";
import { loadLifeEvidenceSnapshot } from "../../storage/snapshots/life-evidence-snapshot.js";
import { createAgentGoalStore } from "../../storage/goal/agent-goal-store.js";
import { createNarrativeStateStore } from "../../storage/narrative/narrative-state-store.js";
import { createRelationshipMemoryStore } from "../../storage/relationship/relationship-memory-store.js";
import { createIdentityProfileStore } from "../../storage/services/identity-profile-store.js";
import { generateHeartbeatDigest, } from "../../observability/services/heartbeat-digest-assembler.js";
import { createHistoryDigestStore } from "../../storage/services/history-digest-store.js";
export async function loadSnapshotInputsForWorkspaceHeartbeat(readModels, options = {}) {
    const status = await readModels.loadStatus();
    const mode = status.rhythm.mode === "unknown" ? "active" : status.rhythm.mode;
    // CH-15-03: quietEnabledBridge should reflect whether the quiet *execution path* is wired
    // (workspaceRoot available), not whether the last observed rhythm decision was "quiet".
    // status.quiet.mode is typically "unknown" until a Quiet artifact has been persisted, which
    // means binding to it would permanently suppress the quiet window — the opposite of intent.
    // We instead enable the bridge whenever workspaceRoot is provided (same condition as
    // `createWorkspaceHeartbeatRunner` uses for injecting quietWorkflow).
    const quietEnabledBridge = !!options.workspaceRoot;
    // T2.2.2: Load life evidence from state DB when available so SnapshotInputs carries real refs.
    let lifeEvidenceRefs;
    let platformEventCount;
    let workEventCount;
    let lifeEvidenceEmptyReason;
    if (options.state && options.workspaceRoot) {
        try {
            const snapshot = await loadLifeEvidenceSnapshot(options.state, options.workspaceRoot, { limit: 50 }, 
            // Skip repair gate here — runner is called inside a live cycle; gate ran at startup.
            { runRepairGate: false });
            lifeEvidenceRefs = snapshot.evidenceRefs.map((ref) => ({
                id: ref.id,
                kind: ref.kind,
                uri: ref.uri,
            }));
            platformEventCount = snapshot.platformEvents.length;
            workEventCount = snapshot.workEvents.length;
            if (snapshot.empty) {
                // L-01: Currently snapshot only exposes `empty` boolean.
                // Future: if snapshot adds `emptyReason` (e.g. "redacted_only"), map it here.
                lifeEvidenceEmptyReason = "no_sources";
            }
        }
        catch {
            // If evidence load fails, signal state_unavailable rather than crashing the cycle.
            lifeEvidenceRefs = [];
            platformEventCount = 0;
            workEventCount = 0;
            lifeEvidenceEmptyReason = "state_unavailable";
        }
    }
    else {
        // No state wired — record that life evidence wasn't loaded so guards can reason honestly.
        lifeEvidenceEmptyReason = "state_unavailable";
    }
    // T2.1.4: Load accepted goals from state DB when available.
    // M-03: typed as GoalContext to avoid coupling to the full AgentGoal schema.
    let acceptedGoals;
    let acceptedGoalsLoadError;
    if (options.state) {
        try {
            const goalStore = createAgentGoalStore(options.state);
            acceptedGoals = await goalStore.listAgentGoals({
                statuses: ["accepted"],
                limit: 20,
            });
        }
        catch (err) {
            acceptedGoals = [];
            acceptedGoalsLoadError = err instanceof Error ? err.message : String(err);
            // H-05: Distinguish "load failed" from "no goals" for observability.
        }
    }
    // CR-02: Load narrative state and relationship memory when state is available.
    let narrativeState;
    let relationshipMemory;
    let identity;
    if (options.state) {
        try {
            const narrativeStore = createNarrativeStateStore(options.state);
            narrativeState = (await narrativeStore.loadNarrativeState()) ?? undefined;
        }
        catch {
            // Narrative state is optional; failure should not block the cycle.
        }
        try {
            const relationshipStore = createRelationshipMemoryStore(options.state);
            relationshipMemory = (await relationshipStore.loadRelationshipMemory()) ?? undefined;
        }
        catch {
            // Relationship memory is optional; failure should not block the cycle.
        }
        try {
            const identityStore = createIdentityProfileStore(options.state);
            const identityResult = await identityStore.loadIdentityProfile("default");
            if (identityResult.status === "loaded" && identityResult.profile) {
                identity = identityResult.profile;
            }
        }
        catch {
            // Identity is optional; failure should not block the cycle.
        }
    }
    return {
        mode,
        currentWindowId: status.rhythm.windowId ?? "workspace-default",
        pendingObligations: [],
        recentOutreachHashes: [],
        deniedIntents: [],
        budgets: { socialUsed: 0, socialLimit: 5 },
        awaitingUserInput: false,
        quietEnabledBridge,
        deliveryCapability: { target: "none" },
        lifeEvidenceRefs,
        platformEventCount,
        workEventCount,
        lifeEvidenceEmptyReason,
        acceptedGoals,
        acceptedGoalsLoadError,
        narrativeState,
        relationshipMemory,
        affordanceMap: options.affordanceMap,
        identity,
    };
}
export function createWorkspaceHeartbeatRunner(readModels, options = {}) {
    // T1.2.4: inject quietWorkflow dep when workspaceRoot is set so quiet/reflection intents
    // can trigger runSourceBackedQuiet and persist artifacts to disk.
    const quietEnabled = options.workspaceRoot && options.enableQuietWorkflow !== false;
    // T2.1.5: when state DB is wired, create a NarrativeStateStore for heartbeat updates.
    const narrativeStateStore = options.state
        ? createNarrativeStateStore(options.state)
        : undefined;
    return async (signal) => {
        const cycle = await runHeartbeatCycle({
            signal,
            runtimeAvailable: true,
            deps: {
                loadSnapshotInputs: () => loadSnapshotInputsForWorkspaceHeartbeat(readModels, {
                    state: options.state,
                    workspaceRoot: options.workspaceRoot,
                    affordanceMap: options.affordanceMap,
                }),
                // T1.2.4: pass quietWorkflow dep so runSourceBackedQuiet can persist artifacts.
                quietWorkflow: quietEnabled
                    ? {
                        workspaceRoot: options.workspaceRoot,
                        // v7 T-V7C.C.3: pass Dream schedule port so Quiet completion triggers Dream.
                        dreamSchedulePort: options.dreamSchedulePort,
                    }
                    : undefined,
                connectorExecutor: options.connectorExecutor,
                narrativeStateStore,
                // T3.3.1: pass state + workspaceRoot so connector effects can write life evidence.
                state: options.state,
                workspaceRoot: options.workspaceRoot,
                // T2.4.1: pass registry so planner resolves platform-specific intents.
                connectorRegistry: options.connectorRegistry,
                // v7 T-V7C.C.2: pass experience writer for heartbeat connector attempts.
                experienceWriter: options.experienceWriter,
            },
        });
        if (options.runtimeRecorder) {
            try {
                await options.runtimeRecorder.recordHeartbeatCycle({ cycle, signal });
            }
            catch {
                // T1.2.3: recorder must never break the heartbeat surface response.
                // Failure here means status simply remains at its previous aggregate; the
                // cycle outcome itself is still returned to the caller.
            }
        }
        // v7 T-V7C.C.3 / T-V7C.C.6: After each cycle, attempt HeartbeatDigest generation
        // and persist to heartbeat_digest table so the digest index actually grows.
        // Only runs inside the designated UTC digest window hour, or on every cycle when
        // digestWindowHour is unset (test / always-on mode).
        if (options.digestOpts) {
            const { assemblerDeps, digestWindowHour } = options.digestOpts;
            const nowHour = new Date().getUTCHours();
            const inDigestWindow = digestWindowHour === undefined || nowHour === digestWindowHour;
            if (inDigestWindow) {
                try {
                    const date = new Date().toISOString().slice(0, 10);
                    const assembledDigest = await generateHeartbeatDigest(date, assemblerDeps);
                    // v7 T-V7C.C.6: Persist assembled digest to heartbeat_digest table when state DB is wired.
                    if (options.state) {
                        const digestStore = createHistoryDigestStore(options.state);
                        await digestStore.writeHeartbeatDigest(toStoreDigest(assembledDigest));
                    }
                }
                catch (err) {
                    // Digest generation / persistence must not break the heartbeat cycle response.
                    const msg = err instanceof Error ? err.message : String(err);
                    console.warn(`[workspace-heartbeat-runner] Digest generation/persistence failed: ${msg}`);
                }
            }
        }
        return cycle;
    };
}
/**
 * Bridge: converts the assembler-facing HeartbeatDigest into the storage-facing
 * HeartbeatDigest (shared/types/v7-entities.ts) so it can be written to heartbeat_digest.
 *
 * The two shapes diverge by design: assembler is an audit-aggregate rich view;
 * store is a flattened day-keyed row. Mapping is lossy but sufficient for growth.
 */
function toStoreDigest(d) {
    return {
        digestId: `digest:${d.date}:${Date.now()}`,
        day: d.date,
        connectorSummary: d.connectorSummary.map((c) => ({
            platformId: c.platformId,
            status: c.blockedCount > 0
                ? "blocked"
                : c.circuitOpenCount > 0
                    ? "blocked"
                    : c.failureCount > 0
                        ? "degraded"
                        : "ok",
            attemptCount: c.successCount + c.failureCount + c.blockedCount,
        })),
        goalSummary: [
            { kind: "new", activeCount: d.goalSummary.newGoals },
            { kind: "completed", activeCount: d.goalSummary.completedGoals },
            { kind: "expired", activeCount: d.goalSummary.expiredGoals },
            { kind: "replaced", activeCount: d.goalSummary.replacedGoals },
            { kind: "active", activeCount: d.goalSummary.activeGoals },
        ].filter((g) => g.activeCount > 0),
        quietCount: d.quietDreamSummary.quietRuns,
        dreamCount: d.quietDreamSummary.dreamRuns,
        breakerSummary: d.healthSummary.circuitBreakerChanges > 0
            ? [{ connectorId: "aggregate", state: "changed" }]
            : [],
        healthStatus: d.healthSummary.auditChainHealthy ? "ok" : "degraded",
        createdAt: d.generatedAt,
    };
}
