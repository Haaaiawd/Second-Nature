/**
 * Wires CLI read models into control-plane `runHeartbeatCycle` for `heartbeat_check` (US-001 / CH-09-02 / T1.2.3).
 *
 * Snapshot inputs are derived from aggregated status; delivery defaults to none until host capability is modeled here.
 *
 * T1.2.3: when a `RuntimeDecisionRecorder` is provided, persist a `sn-runtime-*` ledger row +
 * `second-nature-runtime` execution attempt after each cycle so `loadStatus` exits its `unknown`
 * baseline once the runtime has actually executed at least one full-runtime turn.
 */
import type { HeartbeatSignal, HeartbeatCycleResult } from "../../core/second-nature/heartbeat/signal.js";
import type { SnapshotInputs } from "../../core/second-nature/heartbeat/snapshot-builder.js";
import { runHeartbeatCycle } from "../../core/second-nature/heartbeat/run-heartbeat-cycle.js";
import type { CliReadModels } from "../read-models/index.js";
import type { RuntimeDecisionRecorder } from "../../observability/services/runtime-decision-recorder.js";

export interface WorkspaceHeartbeatRunnerOptions {
  /** When supplied, the runner persists the cycle so `loadStatus` can read it (T1.2.3). */
  runtimeRecorder?: RuntimeDecisionRecorder;
}

export async function loadSnapshotInputsForWorkspaceHeartbeat(readModels: CliReadModels): Promise<SnapshotInputs> {
  const status = await readModels.loadStatus();
  const mode = status.rhythm.mode === "unknown" ? "active" : status.rhythm.mode;
  const quietEnabledBridge = status.quiet.mode === "quiet";
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
  };
}

export function createWorkspaceHeartbeatRunner(
  readModels: CliReadModels,
  options: WorkspaceHeartbeatRunnerOptions = {},
): (signal: HeartbeatSignal) => Promise<HeartbeatCycleResult> {
  return async (signal) => {
    const cycle = await runHeartbeatCycle({
      signal,
      runtimeAvailable: true,
      deps: {
        loadSnapshotInputs: () => loadSnapshotInputsForWorkspaceHeartbeat(readModels),
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
