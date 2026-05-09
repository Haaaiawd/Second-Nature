/**
 * Control-plane heartbeat cycle entry (T2.1.1).
 *
 * Core logic: runtime availability gate → scope routing (user_task bypasses rhythm) →
 * rhythm path delegates to ingestRhythmSignal. Mirrors L0 control-plane-system §4.3.
 *
 * Boundaries: does not claim lived-experience completion when runtime is unavailable;
 * user_task / user_reply do not enter the rhythm candidate planner.
 */
import type { HeartbeatSignal, HeartbeatCycleResult } from "./signal.js";
import type { HeartbeatDeps } from "./heartbeat-loop.js";
export interface RunHeartbeatCycleInput {
    signal: HeartbeatSignal;
    /** When false, return runtime_carrier_only without loading snapshots (host-safe carrier). */
    runtimeAvailable: boolean;
    deps: HeartbeatDeps;
}
/**
 * Single entry for one heartbeat turn: scope routing, runtime gate, then rhythm loop if applicable.
 */
export declare function runHeartbeatCycle(input: RunHeartbeatCycleInput): Promise<HeartbeatCycleResult>;
