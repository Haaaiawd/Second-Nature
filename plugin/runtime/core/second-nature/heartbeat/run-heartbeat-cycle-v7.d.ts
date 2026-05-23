/**
 * runHeartbeatV7 — T-CP.C.2
 *
 * Core logic: v7 heartbeat main loop entry.
 * - Scope routing (rhythm / user_task / user_reply)
 * - EmbodiedContext assembly via EmbodiedContextAssembler
 * - Candidate planning via injected CandidateIntentPlanner
 * - Hard guard evaluation with affordance + breaker awareness
 * - Downstream request orchestration
 * - Decision trace emission
 *
 * Performance: assembly + planning + guards P95 < 2s.
 *   Exceeding samples are marked degraded but do not crash.
 *
 * Boundary:
 * - Does NOT write state, execute connectors, or generate guidance copy.
 * - Returns HeartbeatDecision; downstream execution is delegated.
 *
 * Dependencies:
 * - EmbodiedContextAssembler from ./embodied-context-assembler.js
 * - evaluateHardGuards from ../orchestrator/hard-guard-evaluator.js
 * - createDownstreamIntentOrchestrator from ../orchestrator/downstream-intent-orchestrator.js
 * - createDecisionTraceEmitter from ./decision-trace-emitter.js
 * - routeScopedInput from ./scope-router.js
 *
 * Test coverage:
 * - tests/unit/control-plane/run-heartbeat-cycle-v7.test.ts
 * - tests/integration/control-plane/heartbeat-loop.test.ts
 */
import type { HeartbeatSignal, RuntimeScope } from "./signal.js";
import type { EmbodiedContextAssembler } from "./embodied-context-assembler.js";
import type { CandidateIntent, GuardEvaluation } from "../types.js";
import type { HardGuardEvaluatorDeps } from "../orchestrator/hard-guard-evaluator.js";
import type { DownstreamIntentOrchestrator } from "../orchestrator/downstream-intent-orchestrator.js";
import type { DecisionTraceEmitter } from "./decision-trace-emitter.js";
import type { EmbodiedContext } from "../../../shared/types/v7-entities.js";
export type HeartbeatDecisionStatus = "heartbeat_ok" | "intent_selected" | "deferred" | "denied" | "delivery_unavailable" | "runtime_carrier_only";
export interface HeartbeatDecision {
    decisionId: string;
    scope: RuntimeScope;
    status: HeartbeatDecisionStatus;
    selectedIntentId?: string;
    downstreamRequestId?: string;
    reasons: string[];
    contextId?: string;
}
export interface CandidateIntentPlanner {
    planCandidates(context: EmbodiedContext): CandidateIntent[];
}
export interface HeartbeatV7Deps {
    assembler: EmbodiedContextAssembler;
    planner: CandidateIntentPlanner;
    evaluateHardGuards: (intent: CandidateIntent, deps: HardGuardEvaluatorDeps) => GuardEvaluation;
    buildGuardDeps: (context: EmbodiedContext) => HardGuardEvaluatorDeps;
    downstreamOrchestrator: DownstreamIntentOrchestrator;
    traceEmitter: DecisionTraceEmitter;
}
export interface RunHeartbeatV7Input {
    signal: HeartbeatSignal;
    runtimeAvailable: boolean;
    deps: HeartbeatV7Deps;
}
export declare function runHeartbeatV7(input: RunHeartbeatV7Input): Promise<HeartbeatDecision>;
