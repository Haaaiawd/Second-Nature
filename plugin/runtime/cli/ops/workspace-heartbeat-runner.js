import { runHeartbeatCycle } from "../../core/second-nature/heartbeat/run-heartbeat-cycle.js";
export async function loadSnapshotInputsForWorkspaceHeartbeat(readModels) {
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
export function createWorkspaceHeartbeatRunner(readModels, options = {}) {
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
            }
            catch {
                // T1.2.3: recorder must never break the heartbeat surface response.
                // Failure here means status simply remains at its previous aggregate; the
                // cycle outcome itself is still returned to the caller.
            }
        }
        return cycle;
    };
}
