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
import type { HeartbeatSignal, HeartbeatCycleResult } from "../../core/second-nature/heartbeat/signal.js";
import type { SnapshotInputs } from "../../core/second-nature/heartbeat/snapshot-builder.js";
import type { CliReadModels } from "../read-models/index.js";
import type { RuntimeDecisionRecorder } from "../../observability/services/runtime-decision-recorder.js";
import type { StateDatabase } from "../../storage/db/index.js";
import type { ConnectorExecutor } from "../../core/second-nature/orchestrator/effect-dispatcher.js";
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
}
export declare function loadSnapshotInputsForWorkspaceHeartbeat(readModels: CliReadModels, options?: {
    state?: StateDatabase;
    workspaceRoot?: string;
}): Promise<SnapshotInputs>;
export declare function createWorkspaceHeartbeatRunner(readModels: CliReadModels, options?: WorkspaceHeartbeatRunnerOptions): (signal: HeartbeatSignal) => Promise<HeartbeatCycleResult>;
