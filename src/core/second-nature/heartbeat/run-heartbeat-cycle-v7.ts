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
import type {
  DecisionTraceEmitter,
  DecisionTracePayload,
} from "./decision-trace-emitter.js";
import { routeScopedInput } from "./scope-router.js";

export type HeartbeatDecisionStatus =
  | "heartbeat_ok"
  | "intent_selected"
  | "deferred"
  | "denied"
  | "delivery_unavailable"
  | "runtime_carrier_only";

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
  planCandidates(
    context: import("../../../shared/types/v7-entities.js").EmbodiedContext,
  ): CandidateIntent[];
}

export interface HeartbeatV7Deps {
  assembler: EmbodiedContextAssembler;
  planner: CandidateIntentPlanner;
  evaluateHardGuards: (
    intent: CandidateIntent,
    deps: HardGuardEvaluatorDeps,
  ) => GuardEvaluation;
  buildGuardDeps: (
    context: import("../../../shared/types/v7-entities.js").EmbodiedContext,
  ) => HardGuardEvaluatorDeps;
  downstreamOrchestrator: DownstreamIntentOrchestrator;
  traceEmitter: DecisionTraceEmitter;
}

export interface RunHeartbeatV7Input {
  signal: HeartbeatSignal;
  runtimeAvailable: boolean;
  deps: HeartbeatV7Deps;
}

const P95_MS = 2000;

export async function runHeartbeatV7(
  input: RunHeartbeatV7Input,
): Promise<HeartbeatDecision> {
  const { signal, runtimeAvailable, deps } = input;

  // ── Scope routing ─────────────────────────────────────────────
  const scoped = {
    trigger: signal.trigger,
    scopeHint: signal.scopeHint,
    payload: signal.payload as Record<string, unknown>,
  };
  const route = routeScopedInput(scoped);

  // Runtime availability gate
  if (!runtimeAvailable) {
    return {
      decisionId: `decision:carrier:${Date.now()}`,
      scope: route.scope,
      status: "runtime_carrier_only",
      reasons: ["runtime_unavailable_no_lived_experience_loop"],
    };
  }

  // User task bypass
  if (route.scope === "user_task") {
    return {
      decisionId: `decision:user_task:${Date.now()}`,
      scope: "user_task",
      status: "heartbeat_ok",
      reasons: ["rhythm_gate_bypass_user_task"],
    };
  }

  // User reply light path
  if (route.scope === "user_reply") {
    return {
      decisionId: `decision:user_reply:${Date.now()}`,
      scope: "user_reply",
      status: "heartbeat_ok",
      reasons: ["user_reply_light_continuity_skeleton"],
    };
  }

  // ── Rhythm path: assemble embodied context ──────────────────
  const assemblyStart = Date.now();
  const context = await deps.assembler.assembleEmbodiedContext();
  const assemblyMs = Date.now() - assemblyStart;

  const contextId = `ctx:${Date.now()}`;

  // Build guard deps from assembled context
  const guardDeps = deps.buildGuardDeps(context);

  // Plan candidates
  const candidates = deps.planner.planCandidates(context);

  // Evaluate guards and select first allowed
  for (const intent of candidates) {
    const evaluation = deps.evaluateHardGuards(intent, guardDeps);

    if (evaluation.verdict === "allow") {
      const downstream = deps.downstreamOrchestrator.orchestrate(intent);
      const decisionId = `decision:${intent.id}:${Date.now()}`;
      const result: HeartbeatDecision = {
        decisionId,
        scope: "rhythm",
        status: "intent_selected",
        selectedIntentId: intent.id,
        downstreamRequestId:
          downstream.kind === "none"
            ? undefined
            : `${downstream.kind}:${decisionId}`,
        reasons:
          evaluation.reasons.length > 0
            ? evaluation.reasons
            : ["guard_allow"],
        contextId,
      };

      // P95 degradation note (does not change status per T-CP.C.2 acceptance)
      if (assemblyMs > P95_MS) {
        result.reasons.push(
          `heartbeat_degraded:assembly_p95_exceeded:${assemblyMs}ms`,
        );
      }

      await safeEmitTrace(deps.traceEmitter, result, contextId);
      return result;
    }

    if (evaluation.verdict === "defer") {
      continue;
    }
    // deny / escalate → continue to next candidate
  }

  // ── No allowed candidates ────────────────────────────────────
  const decisionId = `decision:no_allow:${Date.now()}`;
  const result: HeartbeatDecision = {
    decisionId,
    scope: "rhythm",
    status: candidates.length === 0 ? "heartbeat_ok" : "deferred",
    reasons:
      candidates.length === 0
        ? ["silent_no_candidates"]
        : ["no_allow_verdict"],
    contextId,
  };

  if (assemblyMs > P95_MS) {
    result.reasons.push(
      `heartbeat_degraded:assembly_p95_exceeded:${assemblyMs}ms`,
    );
  }

  await safeEmitTrace(deps.traceEmitter, result, contextId);
  return result;
}

async function safeEmitTrace(
  emitter: DecisionTraceEmitter,
  decision: HeartbeatDecision,
  contextId?: string,
): Promise<void> {
  const trace: DecisionTracePayload = {
    traceId: `trace:${decision.decisionId}`,
    decisionId: decision.decisionId,
    contextId,
    scope: decision.scope,
    status: decision.status,
    reasons: decision.reasons,
    selectedIntentId: decision.selectedIntentId,
    emittedAt: new Date().toISOString(),
  };

  try {
    await emitter.emit(trace);
  } catch {
    // Trace emission must not block the heartbeat cycle
  }
}
