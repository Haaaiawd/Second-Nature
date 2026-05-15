import { runHeartbeatCycle } from "../../core/second-nature/heartbeat/run-heartbeat-cycle.js";
import { loadLifeEvidenceSnapshot } from "../../storage/snapshots/life-evidence-snapshot.js";
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
export function createWorkspaceHeartbeatRunner(readModels, options = {}) {
    // T1.2.4: inject quietWorkflow dep when workspaceRoot is set so quiet/reflection intents
    // can trigger runSourceBackedQuiet and persist artifacts to disk.
    const quietEnabled = options.workspaceRoot && options.enableQuietWorkflow !== false;
    return async (signal) => {
        const cycle = await runHeartbeatCycle({
            signal,
            runtimeAvailable: true,
            deps: {
                loadSnapshotInputs: () => loadSnapshotInputsForWorkspaceHeartbeat(readModels, {
                    state: options.state,
                    workspaceRoot: options.workspaceRoot,
                }),
                // T1.2.4: pass quietWorkflow dep so runSourceBackedQuiet can persist artifacts.
                quietWorkflow: quietEnabled
                    ? { workspaceRoot: options.workspaceRoot }
                    : undefined,
                connectorExecutor: options.connectorExecutor,
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
