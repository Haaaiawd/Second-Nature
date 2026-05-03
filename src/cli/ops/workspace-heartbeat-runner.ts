/**
 * Wires CLI read models into control-plane `runHeartbeatCycle` for `heartbeat_check` (US-001 / CH-09-02).
 *
 * Snapshot inputs are derived from aggregated status; delivery defaults to none until host capability is modeled here.
 */
import type { HeartbeatSignal, HeartbeatCycleResult } from "../../core/second-nature/heartbeat/signal.js";
import type { SnapshotInputs } from "../../core/second-nature/heartbeat/snapshot-builder.js";
import { runHeartbeatCycle } from "../../core/second-nature/heartbeat/run-heartbeat-cycle.js";
import type { CliReadModels } from "../read-models/index.js";

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

export function createWorkspaceHeartbeatRunner(readModels: CliReadModels): (signal: HeartbeatSignal) => Promise<HeartbeatCycleResult> {
  return (signal) =>
    runHeartbeatCycle({
      signal,
      runtimeAvailable: true,
      deps: {
        loadSnapshotInputs: () => loadSnapshotInputsForWorkspaceHeartbeat(readModels),
      },
    });
}
