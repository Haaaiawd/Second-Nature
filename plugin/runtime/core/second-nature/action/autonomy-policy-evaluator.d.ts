/**
 * AutonomyPolicyEvaluator — Evaluate ActionProposal against platform policy,
 * affordance posture, and risk flags.
 *
 * Core logic: Table-driven allow/defer/downgrade/deny decisions based on
 * side-effect class, source refs, risk posture, and breaker status.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/action-closure-policy-system.detail.md §3.2, §4.1`
 * - `.anws/v8/04_SYSTEM_DESIGN/action-closure-policy-system.md §4.2`
 *
 * Dependencies:
 * - `src/shared/types/v8-contracts.js` (PlatformNeutralActionKind,
 *   SourceRef, DegradedOperationResult, V8ReasonCode, ACTION_KIND_REGISTRY)
 *
 * Boundary:
 * - Does not execute actions; only evaluates policy.
 * - Does not read external platform state; relies on affordance input.
 * - Pure function for testability; DB write is caller responsibility.
 *
 * Test coverage: tests/unit/action/autonomy-policy-evaluator.test.ts
 */
import type { SourceRef, PlatformNeutralActionKind, V8ReasonCode } from "../../../shared/types/v8-contracts.js";
import type { ActionProposal } from "./action-proposal-builder.js";
export interface ActionPolicyDecision {
    id: string;
    proposalId: string;
    decision: "allow" | "defer" | "downgrade" | "deny";
    decisionReason: V8ReasonCode;
    autonomyLevel: "none" | "draft_only" | "owner_confirm" | "auto_allowed";
    downgradedActionKind?: PlatformNeutralActionKind;
    proofRefs: SourceRef[];
    decidedAt: string;
}
export interface PolicyEvaluationContext {
    breakerStatus?: "closed" | "open" | "half_open";
    platformPermissionDeclared?: boolean;
    ownerPreferenceAllowAuto?: boolean;
}
export interface EvaluateActionPolicyOptions {
    now?: string;
}
export declare function evaluateActionPolicy(proposal: ActionProposal, context: PolicyEvaluationContext, options?: EvaluateActionPolicyOptions): ActionPolicyDecision;
