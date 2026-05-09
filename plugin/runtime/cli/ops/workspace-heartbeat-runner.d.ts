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
import type { CliReadModels } from "../read-models/index.js";
import type { RuntimeDecisionRecorder } from "../../observability/services/runtime-decision-recorder.js";
export interface WorkspaceHeartbeatRunnerOptions {
    /** When supplied, the runner persists the cycle so `loadStatus` can read it (T1.2.3). */
    runtimeRecorder?: RuntimeDecisionRecorder;
}
export declare function loadSnapshotInputsForWorkspaceHeartbeat(readModels: CliReadModels): Promise<SnapshotInputs>;
export declare function createWorkspaceHeartbeatRunner(readModels: CliReadModels, options?: WorkspaceHeartbeatRunnerOptions): (signal: HeartbeatSignal) => Promise<HeartbeatCycleResult>;
