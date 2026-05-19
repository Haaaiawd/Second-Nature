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
import type { ControlPlaneSourceRef } from "../../core/second-nature/types.js";
import type { ConnectorExecutor } from "../../core/second-nature/orchestrator/effect-dispatcher.js";
import type { CapabilityContractRegistry } from "../../connectors/base/manifest.js";

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
}

export async function loadSnapshotInputsForWorkspaceHeartbeat(
  readModels: CliReadModels,
  options: { state?: StateDatabase; workspaceRoot?: string } = {},
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
  let acceptedGoals: import("../../storage/goal/agent-goal-store.js").AgentGoal[] | undefined;
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
          }),
        // T1.2.4: pass quietWorkflow dep so runSourceBackedQuiet can persist artifacts.
        quietWorkflow: quietEnabled
          ? { workspaceRoot: options.workspaceRoot! }
          : undefined,
        connectorExecutor: options.connectorExecutor,
        narrativeStateStore,
        // T3.3.1: pass state + workspaceRoot so connector effects can write life evidence.
        state: options.state,
        workspaceRoot: options.workspaceRoot,
        // T2.4.1: pass registry so planner resolves platform-specific intents.
        connectorRegistry: options.connectorRegistry,
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

    return cycle;
  };
}
