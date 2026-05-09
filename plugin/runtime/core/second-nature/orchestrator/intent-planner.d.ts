/**
 * Candidate intent planner (T2.1.3): window-biased planning + priority cap.
 * `planCandidateIntents` is the contract name; `planIntent` bridges legacy continuity-only tests.
 */
import type { CandidateIntent, ContinuitySnapshot, DecisionBasis } from "../types.js";
import type { HeartbeatRuntimeSnapshot } from "../heartbeat/runtime-snapshot.js";
/**
 * Plan ordered candidates for one heartbeat turn using rhythm window + life evidence slice.
 */
export declare function planCandidateIntents(runtime: HeartbeatRuntimeSnapshot): CandidateIntent[];
/** @deprecated Continuity-only helper for tests; prefer `planCandidateIntents` + `buildHeartbeatRuntimeSnapshot`. */
export declare function planIntent(snapshot: ContinuitySnapshot): CandidateIntent[];
export declare function decideDecisionBasis(intent: CandidateIntent): DecisionBasis;
