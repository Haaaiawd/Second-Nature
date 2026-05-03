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
export function createWorkspaceHeartbeatRunner(readModels) {
    return (signal) => runHeartbeatCycle({
        signal,
        runtimeAvailable: true,
        deps: {
            loadSnapshotInputs: () => loadSnapshotInputsForWorkspaceHeartbeat(readModels),
        },
    });
}
