export {
  type RuntimeScope,
  type RuntimeTrigger,
  type HeartbeatCycleStatus,
  type HeartbeatSignal,
  type ScopedRuntimeInput,
  type HeartbeatCycleResult,
  type ScopeRouteResult,
} from "./signal.js";

export {
  buildContinuitySnapshot,
  type SnapshotInputs,
} from "./snapshot-builder.js";

export {
  ingestRhythmSignal,
  resolveAllowedIntentResult,
  type HeartbeatDeps,
  type HeartbeatOutreachDispatchDeps,
  type HeartbeatQuietWorkflowDeps,
  type HeartbeatDecisionTracePayload,
  buildSnapshotFromInputs,
} from "./heartbeat-loop.js";

export {
  buildHeartbeatRuntimeSnapshot,
  buildLifeEvidenceSliceFromInputs,
  buildHardGuardDeps,
  resolveRhythmPolicyForHeartbeat,
  isLifeEvidenceSliceEmpty,
  type HeartbeatRuntimeSnapshot,
  type PlannerLifeEvidenceSlice,
  type HardGuardDeps,
} from "./runtime-snapshot.js";

export { buildPlannerRhythmWindow, type PlannerRhythmWindowSlice } from "../rhythm/planner-rhythm-window.js";

export { runHeartbeatCycle, type RunHeartbeatCycleInput } from "./run-heartbeat-cycle.js";

export {
  routeScopedInput,
  type ScopeRouterDeps,
} from "./scope-router.js";

export {
  requestGuidanceForIntent,
  dispatchAllowedEffect,
  executeHeartbeatCycle,
  type GuidanceBridgeDeps,
  type EffectDispatchDeps,
  type HeartbeatExecutorDeps,
  type GuidanceBridgeResult,
  type HeartbeatExecutionResult,
} from "./heartbeat-executor.js";

/* Wave 57 — v7 heartbeat main loop + goal/idle policy */
export {
  runHeartbeatV7,
  type HeartbeatDecision,
  type HeartbeatV7Deps,
  type RunHeartbeatV7Input,
} from "./run-heartbeat-cycle-v7.js";

export {
  createDecisionTraceEmitter,
  createNoOpTraceEmitter,
  type DecisionTracePayload,
  type DecisionTraceEmitter,
} from "./decision-trace-emitter.js";

export {
  createGoalLifecyclePolicy,
  type GoalLifecyclePolicy,
  type GoalTransitionRequest,
  type GoalLifecyclePolicyResult,
} from "./goal-lifecycle-policy.js";

export {
  createIdleCuriosityPolicy,
  type IdleCuriosityPolicy,
  type IdleCuriosityCandidate,
  type IdleCuriosityPolicyResult,
} from "./idle-curiosity-policy.js";
