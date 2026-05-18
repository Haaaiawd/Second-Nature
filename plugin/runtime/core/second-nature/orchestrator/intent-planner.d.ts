/**
 * Candidate intent planner (T2.1.3): window-biased planning + priority cap.
 * `planCandidateIntents` is the contract name; `planIntent` bridges legacy continuity-only tests.
 */
import type { CandidateIntent, ContinuitySnapshot, DecisionBasis } from "../types.js";
import type { HeartbeatRuntimeSnapshot } from "../heartbeat/runtime-snapshot.js";
import type { CapabilityContractRegistry } from "../../../connectors/base/manifest.js";
export interface PlanCandidateIntentsOptions {
    /** T2.4.1: accepted goals for platform-specific resolution. */
    acceptedGoals?: import("../../../storage/goal/agent-goal-store.js").AgentGoal[];
    /** T2.4.1: optional connector registry for capability validation. */
    connectorRegistry?: CapabilityContractRegistry;
}
/**
 * Plan ordered candidates for one heartbeat turn using rhythm window + life evidence slice.
 */
export declare function planCandidateIntents(runtime: HeartbeatRuntimeSnapshot, options?: PlanCandidateIntentsOptions): CandidateIntent[];
/** @deprecated Continuity-only helper for tests; prefer `planCandidateIntents` + `buildHeartbeatRuntimeSnapshot`. */
export declare function planIntent(snapshot: ContinuitySnapshot): CandidateIntent[];
export declare function decideDecisionBasis(intent: CandidateIntent): DecisionBasis;
