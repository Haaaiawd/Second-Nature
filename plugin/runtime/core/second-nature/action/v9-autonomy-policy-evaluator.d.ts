/**
 * v9 AutonomyPolicyEvaluator — Evaluate v9 ActionProposal against platform
 * policy, affordance posture, and risk flags.
 *
 * Core logic: Table-driven allow/defer/downgrade/deny decisions based on
 * side-effect class, source refs, risk posture, permission, breaker status,
 * and owner preference. ToolRoutine proposals are evaluated against active
 * status and basic policy context; full guard-schema evaluation is the
 * responsibility of T4.2.2.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/action-closure-policy-system.detail.md §2.1 §3.2 §4.2`
 * - `.anws/v9/04_SYSTEM_DESIGN/action-closure-policy-system.md §4.2`
 * - `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md §6`
 *
 * Dependencies:
 * - `src/shared/types/v9-contracts.js` (v9 action contracts)
 *
 * Boundary:
 * - Does not execute actions; only evaluates policy.
 * - Does not read external platform state; relies on affordance input.
 * - Pure function for testability.
 *
 * Test coverage: `tests/unit/action/v9-autonomy-policy-evaluator.test.ts`
 */
import { type ActionPolicyDecision, type ActionProposal, type PolicyEvaluationContext, type RoutineRegistryStatus } from "../../../shared/types/v9-contracts.js";
export interface EvaluateV9ActionPolicyContext extends PolicyEvaluationContext {
    routineStatus?: RoutineRegistryStatus;
}
export interface EvaluateV9ActionPolicyOptions {
    now?: string;
}
export declare function evaluateV9ActionPolicy(proposal: ActionProposal, context: EvaluateV9ActionPolicyContext, options?: EvaluateV9ActionPolicyOptions): ActionPolicyDecision;
