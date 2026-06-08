/**
 * Wires CLI read models into control-plane `runHeartbeatCycle` for `heartbeat_check` (US-001 / CH-09-02 / T1.2.3).
 *
 * Snapshot inputs are derived from aggregated status; delivery defaults to none until host capability is modeled here.
 *
 * T1.2.3: when a `RuntimeDecisionRecorder` is provided, persist a `sn-runtime-*` ledger row +
 * `second-nature-runtime` execution attempt after each cycle so `loadStatus` exits its `unknown`
 * baseline once the runtime has actually executed at least one full-runtime turn.
 *
 * T2.2.2: when `state` + `workspaceRoot` are supplied, call `loadLifeEvidenceSnapshot` to fill
 * `lifeEvidenceRefs`, `platformEventCount`, `workEventCount`, and `lifeEvidenceEmptyReason` on
 * `SnapshotInputs` so planner/guard paths that require source refs see real DB truth.
 * Falls back gracefully to `lifeEvidenceEmptyReason: "state_unavailable"` when state is absent.
 */
import type {
  HeartbeatSignal,
  HeartbeatCycleResult,
} from "../../core/second-nature/heartbeat/signal.js";
import type { SnapshotInputs } from "../../core/second-nature/heartbeat/snapshot-builder.js";
import { runHeartbeatCycle } from "../../core/second-nature/heartbeat/run-heartbeat-cycle.js";
import type { CliReadModels } from "../read-models/index.js";
import type { RuntimeDecisionRecorder } from "../../observability/services/runtime-decision-recorder.js";
import type { StateDatabase } from "../../storage/db/index.js";
import { loadLifeEvidenceSnapshot } from "../../storage/snapshots/life-evidence-snapshot.js";
import { createAgentGoalStore } from "../../storage/goal/agent-goal-store.js";
import { createNarrativeStateStore } from "../../storage/narrative/narrative-state-store.js";
import { createRelationshipMemoryStore } from "../../storage/relationship/relationship-memory-store.js";
import { createIdentityProfileStore } from "../../storage/services/identity-profile-store.js";
import type { ControlPlaneSourceRef } from "../../core/second-nature/types.js";
import type { ConnectorExecutor } from "../../core/second-nature/orchestrator/effect-dispatcher.js";
import type { CapabilityContractRegistry } from "../../connectors/base/manifest.js";
import type { GoalContext } from "../../core/second-nature/orchestrator/intent-planner.js";
import type { AffordanceMap } from "../../shared/types/v7-entities.js";
import type { ExperienceWriter } from "../../core/second-nature/body/tool-experience/experience-writer.js";
import type { QuietDreamSchedulePort } from "../../core/second-nature/quiet/run-source-backed-quiet.js";
import {
  generateHeartbeatDigest,
  type HeartbeatDigestAssemblerDeps,
} from "../../observability/services/heartbeat-digest-assembler.js";
import { createHistoryDigestStore } from "../../storage/services/history-digest-store.js";
import type { GoalLifecyclePolicy } from "../../core/second-nature/heartbeat/goal-lifecycle-policy.js";
import type { IdleCuriosityPolicy } from "../../core/second-nature/heartbeat/idle-curiosity-policy.js";
import type { CircuitBreakerManager } from "../../core/second-nature/body/circuit-breaker/circuit-breaker-manager.js";
import type { AppendOnlyAuditStore } from "../../observability/audit/append-only-audit-store.js";

export interface WorkspaceHeartbeatRunnerOptions {
  /** When supplied, the runner persists the cycle so `loadStatus` can read it (T1.2.3). */
  runtimeRecorder?: RuntimeDecisionRecorder;
  /**
   * T2.2.2: when state + workspaceRoot are provided, life evidence is loaded from DB and merged
   * into SnapshotInputs so planner/guard paths have real source-ref truth.
   */
  state?: StateDatabase;
  workspaceRoot?: string;
  /**
   * T1.2.4: when true (and workspaceRoot is set), inject a `quietWorkflow` dep into the heartbeat
   * cycle so quiet/reflection intents can call `runSourceBackedQuiet` and write artifacts to disk.
   * Defaults to true when workspaceRoot is provided, since this is the host-safe workspace path.
   */
  enableQuietWorkflow?: boolean;
  /**
   * When present, guard-allowed connector_action intents are dispatched through the
   * connector-system instead of returning connector_dispatch_unwired.
   */
  connectorExecutor?: ConnectorExecutor;
  /**
   * T2.4.1: when present, planner resolves platform-specific intents from accepted goals
   * and connector evidence.
   */
  connectorRegistry?: CapabilityContractRegistry;
  /** v7 T-V7C.C.2: affordance map for breaker-aware guard evaluation. */
  affordanceMap?: AffordanceMap;
  /** v7 T-V7C.C.2: experience writer for heartbeat connector attempts. */
  experienceWriter?: ExperienceWriter;
  /** v7 T-V7C.C.3: when present, a successful Quiet write auto-triggers Dream scheduling. */
  dreamSchedulePort?: QuietDreamSchedulePort;
  /** v7 T-CP.C.3: goal lifecycle policy for evaluating goal transitions before planning. */
  goalLifecyclePolicy?: GoalLifecyclePolicy;
  /** v7 T-CP.C.3: idle curiosity policy for read-only sensing when no active goals exist. */
  idleCuriosityPolicy?: IdleCuriosityPolicy;
  /** v7 T-BTS.C.5: circuit breaker manager for tracking connector execution health. */
  circuitBreakerManager?: CircuitBreakerManager;
  /**
   * v7 T-V7C.C.3: when present, generates a HeartbeatDigest after each cycle
   * (inside the digest window hour, if specified) and attempts delivery.
   * Digest delivery failure is recorded as fallbackReason — never blocks the cycle.
   */
  digestOpts?: {
    assemblerDeps: HeartbeatDigestAssemblerDeps;
    /**
     * UTC hour (0–23) at which to attempt digest generation.
     * If unset, digest is generated on every cycle (for testing / always-on mode).
     */
    digestWindowHour?: number;
  };
  /** T-OBS.R.1: shared audit sink for heartbeat connector and Quiet outcomes. */
  auditStore?: AppendOnlyAuditStore;
}

export async function loadSnapshotInputsForWorkspaceHeartbeat(
  readModels: CliReadModels,
  options: { state?: StateDatabase; workspaceRoot?: string; affordanceMap?: AffordanceMap } = {},
): Promise<SnapshotInputs> {
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
  let lifeEvidenceRefs: ControlPlaneSourceRef[] | undefined;
  let platformEventCount: number | undefined;
  let workEventCount: number | undefined;
  let lifeEvidenceEmptyReason: SnapshotInputs["lifeEvidenceEmptyReason"];

  if (options.state && options.workspaceRoot) {
    try {
      const snapshot = await loadLifeEvidenceSnapshot(
        options.state,
        options.workspaceRoot,
        { limit: 50 },
        // Skip repair gate here — runner is called inside a live cycle; gate ran at startup.
        { runRepairGate: false },
      );
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
    } catch {
      // If evidence load fails, signal state_unavailable rather than crashing the cycle.
      lifeEvidenceRefs = [];
      platformEventCount = 0;
      workEventCount = 0;
      lifeEvidenceEmptyReason = "state_unavailable";
    }
  } else {
    // No state wired — record that life evidence wasn't loaded so guards can reason honestly.
    lifeEvidenceEmptyReason = "state_unavailable";
  }

  // T2.1.4: Load accepted goals from state DB when available.
  // M-03: typed as GoalContext to avoid coupling to the full AgentGoal schema.
  let acceptedGoals: GoalContext[] | undefined;
  let acceptedGoalsLoadError: string | undefined;
  if (options.state) {
    try {
      const goalStore = createAgentGoalStore(options.state);
      acceptedGoals = await goalStore.listAgentGoals({
        statuses: ["accepted"],
        limit: 20,
      });
    } catch (err) {
      acceptedGoals = [];
      acceptedGoalsLoadError = err instanceof Error ? err.message : String(err);
      // H-05: Distinguish "load failed" from "no goals" for observability.
    }
  }

  // CR-02: Load narrative state and relationship memory when state is available.
  let narrativeState: import("../../storage/narrative/narrative-state-store.js").NarrativeState | undefined;
  let relationshipMemory: import("../../storage/relationship/relationship-memory-store.js").RelationshipMemory | undefined;
  let identity: import("../../shared/types/v7-entities.js").IdentityProfile | undefined;
  if (options.state) {
    try {
      const narrativeStore = createNarrativeStateStore(options.state);
      narrativeState = (await narrativeStore.loadNarrativeState()) ?? undefined;
    } catch {
      // Narrative state is optional; failure should not block the cycle.
    }
    try {
      const relationshipStore = createRelationshipMemoryStore(options.state);
      relationshipMemory = (await relationshipStore.loadRelationshipMemory()) ?? undefined;
    } catch {
      // Relationship memory is optional; failure should not block the cycle.
    }
    try {
      const identityStore = createIdentityProfileStore(options.state);
      const identityResult = await identityStore.loadIdentityProfile("default");
      if (identityResult.status === "loaded" && identityResult.profile) {
        identity = identityResult.profile;
      }
    } catch {
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

export function createWorkspaceHeartbeatRunner(
  readModels: CliReadModels,
  options: WorkspaceHeartbeatRunnerOptions = {},
): (signal: HeartbeatSignal) => Promise<HeartbeatCycleResult> {
  // T1.2.4: inject quietWorkflow dep when workspaceRoot is set so quiet/reflection intents
  // can trigger runSourceBackedQuiet and persist artifacts to disk.
  const quietEnabled =
    options.workspaceRoot && options.enableQuietWorkflow !== false;

  // T2.1.5: when state DB is wired, create a NarrativeStateStore for heartbeat updates.
  const narrativeStateStore = options.state
    ? createNarrativeStateStore(options.state)
    : undefined;

  return async (signal) => {
    const cycle = await runHeartbeatCycle({
      signal,
      runtimeAvailable: true,
      deps: {
        loadSnapshotInputs: () =>
          loadSnapshotInputsForWorkspaceHeartbeat(readModels, {
            state: options.state,
            workspaceRoot: options.workspaceRoot,
            affordanceMap: options.affordanceMap,
          }),
        // T1.2.4: pass quietWorkflow dep so runSourceBackedQuiet can persist artifacts.
        quietWorkflow: quietEnabled
          ? {
              workspaceRoot: options.workspaceRoot!,
              // v7 T-V7C.C.3: pass Dream schedule port so Quiet completion triggers Dream.
              dreamSchedulePort: options.dreamSchedulePort,
              auditStore: options.auditStore,
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
        // v7 T-CP.C.3: pass goal lifecycle policy for pre-planning goal evaluation.
        goalLifecyclePolicy: options.goalLifecyclePolicy,
        // v7 T-CP.C.3: pass idle curiosity policy for goal-less exploration.
        idleCuriosityPolicy: options.idleCuriosityPolicy,
        // v7 T-BTS.C.5: pass circuit breaker manager for execution health tracking.
        circuitBreakerManager: options.circuitBreakerManager,
        auditStore: options.auditStore,
      },
    });

    if (options.runtimeRecorder) {
      try {
        await options.runtimeRecorder.recordHeartbeatCycle({ cycle, signal });
      } catch {
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
      const inDigestWindow =
        digestWindowHour === undefined || nowHour === digestWindowHour;
      if (inDigestWindow) {
        try {
          const date = new Date().toISOString().slice(0, 10);
          const assembledDigest = await generateHeartbeatDigest(date, assemblerDeps);
          // v7 T-V7C.C.6: Persist assembled digest to heartbeat_digest table when state DB is wired.
          if (options.state) {
            const digestStore = createHistoryDigestStore(options.state);
            await digestStore.writeHeartbeatDigest(
              toStoreDigest(assembledDigest),
            );
          }
        } catch (err) {
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
function toStoreDigest(
  d: import("../../observability/services/heartbeat-digest-assembler.js").HeartbeatDigest,
): import("../../shared/types/v7-entities.js").HeartbeatDigest {
  return {
    digestId: `digest:${d.date}:${Date.now()}`,
    day: d.date,
    connectorSummary: d.connectorSummary.map((c) => ({
      platformId: c.platformId,
      status:
        c.blockedCount > 0
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
    breakerSummary:
      d.healthSummary.circuitBreakerChanges > 0
        ? [{ connectorId: "aggregate", state: "changed" }]
        : [],
    healthStatus: d.healthSummary.auditChainHealthy ? "ok" : "degraded",
    createdAt: d.generatedAt,
  };
}
