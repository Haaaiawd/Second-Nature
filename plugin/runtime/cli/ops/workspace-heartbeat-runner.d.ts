/**
 * Wires CLI read models into control-plane `runHeartbeatCycle` for `heartbeat_check` (US-001 / CH-09-02).
 *
 * Snapshot inputs are derived from aggregated status; delivery defaults to none until host capability is modeled here.
 */
import type { HeartbeatSignal, HeartbeatCycleResult } from "../../core/second-nature/heartbeat/signal.js";
import type { SnapshotInputs } from "../../core/second-nature/heartbeat/snapshot-builder.js";
import type { CliReadModels } from "../read-models/index.js";
export declare function loadSnapshotInputsForWorkspaceHeartbeat(readModels: CliReadModels): Promise<SnapshotInputs>;
export declare function createWorkspaceHeartbeatRunner(readModels: CliReadModels): (signal: HeartbeatSignal) => Promise<HeartbeatCycleResult>;
