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

import {
  type ActionPolicyDecision,
  type ActionProposal,
  type PlatformNeutralActionKind,
  type PolicyEvaluationContext,
  type RoutineRegistryStatus,
  type SourceRef,
  type V9ReasonCode,
  V9_ACTION_KIND_REGISTRY,
} from "../../../shared/types/v9-contracts.js";

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

export interface EvaluateV9ActionPolicyContext extends PolicyEvaluationContext {
  routineStatus?: RoutineRegistryStatus;
}

export interface EvaluateV9ActionPolicyOptions {
  now?: string;
}

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

function isOwnerAttentionAction(
  actionKind: PlatformNeutralActionKind,
): boolean {
  return actionKind === "notify_owner";
}

function downgradeTarget(
  actionKind: PlatformNeutralActionKind,
): PlatformNeutralActionKind | undefined {
  const meta = V9_ACTION_KIND_REGISTRY[actionKind];
  if (!meta || meta.allowedDowngrades.length === 0) return undefined;
  return meta.allowedDowngrades[0];
}

function buildProofRefs(
  proposal: ActionProposal,
  context: EvaluateV9ActionPolicyContext,
): SourceRef[] {
  return [
    ...(context.affordancePosture?.sourceRefs ?? []),
    ...(proposal.sourceRefs.length > 0 ? proposal.sourceRefs.slice(0, 1) : []),
    { family: "action", id: proposal.id },
  ];
}

// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────

export function evaluateV9ActionPolicy(
  proposal: ActionProposal,
  context: EvaluateV9ActionPolicyContext,
  options?: EvaluateV9ActionPolicyOptions,
): ActionPolicyDecision {
  const now = options?.now ?? new Date().toISOString();
  const proposalId = proposal.id;
  const decisionId = `dec_${proposalId}_${now.replace(/[:.]/g, "")}`;
  const proofRefs = buildProofRefs(proposal, context);

  function decision(
    decisionValue: ActionPolicyDecision["decision"],
    decisionReason: V9ReasonCode,
    autonomyLevel: ActionPolicyDecision["autonomyLevel"],
    downgradedActionKind?: PlatformNeutralActionKind,
  ): ActionPolicyDecision {
    return {
      id: decisionId,
      proposalId,
      decision: decisionValue,
      decisionReason,
      autonomyLevel,
      downgradedActionKind,
      proofRefs,
      decidedAt: now,
    };
  }

  // 1. Missing source refs for any side-effecting action → deny.
  if (
    proposal.sourceRefs.length === 0 &&
    proposal.sideEffectClass !== "none"
  ) {
    return decision("deny", "policy_denied_missing_permission", "none");
  }

  // 2. Risk blocked → deny.
  if (proposal.riskPosture === "blocked") {
    return decision("deny", "policy_denied_high_risk", "none");
  }

  // 3. Routine proposal → active + healthy context required.
  if (proposal.sideEffectClass === "routine") {
    if (context.routineStatus !== "active") {
      return decision("deny", "routine_invocation_denied", "none");
    }
    if (
      !context.platformPermissionDeclared ||
      !context.circuitBreakerClosed ||
      !context.ownerPreference
    ) {
      return decision("deny", "routine_guard_policy_denied", "none");
    }
    return decision("allow", "policy_allowed", "auto_allowed");
  }

  // 4. External write / capability-declared actions.
  if (
    proposal.sideEffectClass === "external_write" ||
    proposal.sideEffectClass === "capability_declared"
  ) {
    // High risk → deny.
    if (proposal.riskPosture === "high") {
      return decision("deny", "policy_denied_high_risk", "none");
    }

    // Missing permission, open breaker, or owner preference blocks auto → deny.
    if (!context.platformPermissionDeclared) {
      return decision("deny", "policy_denied_missing_permission", "none");
    }
    if (!context.circuitBreakerClosed) {
      return decision("deny", "policy_denied_breaker_open", "none");
    }
    if (!context.ownerPreference) {
      return decision("deny", "policy_denied_missing_permission", "none");
    }

    // Medium-risk external_write → downgrade to owner_confirm.
    if (
      proposal.sideEffectClass === "external_write" &&
      proposal.riskPosture === "medium"
    ) {
      const target = downgradeTarget(proposal.actionKind);
      if (target) {
        return decision(
          "downgrade",
          "policy_downgraded_to_draft",
          "owner_confirm",
          target,
        );
      }
    }

    return decision("allow", "policy_allowed", "auto_allowed");
  }

  // 5. Owner attention → downgrade to draft/notify (before breaker check; L1 §1.1).
  if (proposal.sideEffectClass === "owner_attention") {
    const target = downgradeTarget(proposal.actionKind);
    if (target) {
      return decision(
        "downgrade",
        "policy_downgraded_to_draft",
        "draft_only",
        target,
      );
    }
    return decision("allow", "policy_allowed", "auto_allowed");
  }

  // 6. Circuit breaker open → deny (remaining actions).
  if (!context.circuitBreakerClosed) {
    return decision("deny", "policy_denied_breaker_open", "none");
  }

  // 7. None / local_state → allow.
  return decision("allow", "policy_allowed", "auto_allowed");
}
