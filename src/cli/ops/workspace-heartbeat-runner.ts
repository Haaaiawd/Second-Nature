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
import type { ControlPlaneSourceRef } from "../../core/second-nature/types.js";

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
}

export async function loadSnapshotInputsForWorkspaceHeartbeat(
  readModels: CliReadModels,
  options: { state?: StateDatabase; workspaceRoot?: string } = {},
): Promise<SnapshotInputs> {
  const status = await readModels.loadStatus();
  const mode = status.rhythm.mode === "unknown" ? "active" : status.rhythm.mode;
  const quietEnabledBridge = status.quiet.mode === "quiet";

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
