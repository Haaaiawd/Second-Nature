import type { CandidateIntent, ContinuitySnapshot, GuardEvaluation } from "../types.js";
import type { HeartbeatRuntimeSnapshot } from "../heartbeat/runtime-snapshot.js";
/**
 * Hard guard evaluation (T2.1.3): source, dedupe, cooldown, quiet bias, budget, risk, awaiting user.
 */
export declare function evaluateHardGuards(intent: CandidateIntent, runtime: HeartbeatRuntimeSnapshot): GuardEvaluation;
/** Continuity-only guard path for legacy call sites; builds a minimal runtime snapshot. */
export declare function evaluateGuards(intent: CandidateIntent, snapshot: ContinuitySnapshot): GuardEvaluation;
