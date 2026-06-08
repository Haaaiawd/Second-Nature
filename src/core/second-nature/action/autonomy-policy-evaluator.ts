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

import type {
  SourceRef,
  DegradedOperationResult,
  PlatformNeutralActionKind,
  V8ReasonCode,
} from "../../../shared/types/v8-contracts.js";
import { ACTION_KIND_REGISTRY } from "../../../shared/types/v8-contracts.js";
import type { ActionProposal } from "./action-proposal-builder.js";

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

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

// ───────────────────────────────────────────────────────────────
// Config
// ───────────────────────────────────────────────────────────────

const AUTO_WRITE_MIN_RISK: ActionProposal["riskPosture"] = "low";

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

function isWriteSideEffect(sideEffectClass: string): boolean {
  return sideEffectClass === "external_write" || sideEffectClass === "capability_declared";
}

function isOwnerAttentionAction(actionKind: PlatformNeutralActionKind): boolean {
  return ["notify_owner", "draft_reply", "draft_publish"].includes(actionKind);
}

function canAutoRun(actionKind: PlatformNeutralActionKind, riskPosture: ActionProposal["riskPosture"]): boolean {
  const meta = ACTION_KIND_REGISTRY[actionKind];
  if (!meta) return false;
  if (meta.sideEffectClass === "external_write" && riskPosture !== "low") return false;
  if (meta.sideEffectClass === "external_write" && riskPosture === "low") return true;
  if (meta.sideEffectClass === "capability_declared") return riskPosture === "low";
  if (meta.sideEffectClass === "owner_attention") return riskPosture === "low" || riskPosture === "medium";
  return meta.requiresPolicyDecision === false || meta.sideEffectClass === "none" || meta.sideEffectClass === "local_state";
}

function downgradeTarget(actionKind: PlatformNeutralActionKind): PlatformNeutralActionKind | undefined {
  const meta = ACTION_KIND_REGISTRY[actionKind];
  if (!meta || meta.allowedDowngrades.length === 0) return undefined;
  return meta.allowedDowngrades[0];
}

// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────

export function evaluateActionPolicy(
  proposal: ActionProposal,
  context: PolicyEvaluationContext,
  options?: EvaluateActionPolicyOptions,
): ActionPolicyDecision {
  const now = options?.now ?? new Date().toISOString();
  const proposalId = proposal.id;
  const decisionId = `dec_${proposalId}_${now.replace(/[:.]/g, "")}`;

  const proofRefs: SourceRef[] = proposal.sourceRefs.length > 0
    ? proposal.sourceRefs
    : [
        {
          uri: `sn://policy/${proposalId}`,
          family: "action_closure",
          id: proposalId,
          redactionClass: "none",
          resolveStatus: "resolvable",
        },
      ];

  // 1. Missing source refs for owner/write actions → deny
  if (
    proposal.sourceRefs.length === 0 &&
    (isWriteSideEffect(proposal.sideEffectClass) || isOwnerAttentionAction(proposal.actionKind))
  ) {
    return {
      id: decisionId,
      proposalId,
      decision: "deny",
      decisionReason: "policy_denied_missing_permission",
      autonomyLevel: "none",
      proofRefs,
      decidedAt: now,
    };
  }

  // 2. Risk blocked or high → deny or defer
  if (proposal.riskPosture === "blocked") {
    return {
      id: decisionId,
      proposalId,
      decision: "deny",
      decisionReason: "policy_denied_high_risk",
      autonomyLevel: "none",
      proofRefs,
      decidedAt: now,
    };
  }

  if (proposal.riskPosture === "high") {
    return {
      id: decisionId,
      proposalId,
      decision: "defer",
      decisionReason: "policy_deferred_owner_confirmation",
      autonomyLevel: "owner_confirm",
      proofRefs,
      decidedAt: now,
    };
  }

  // 3. Circuit breaker open → deny
  if (context.breakerStatus === "open") {
    return {
      id: decisionId,
      proposalId,
      decision: "deny",
      decisionReason: "policy_denied_breaker_open",
      autonomyLevel: "none",
      proofRefs,
      decidedAt: now,
    };
  }

  // 4. Write-side action + no platform permission → downgrade or deny
  if (
    isWriteSideEffect(proposal.sideEffectClass) &&
    context.platformPermissionDeclared === false
  ) {
    const target = downgradeTarget(proposal.actionKind);
    if (target) {
      return {
        id: decisionId,
        proposalId,
        decision: "downgrade",
        decisionReason: "policy_downgraded_to_draft",
        autonomyLevel: "draft_only",
        downgradedActionKind: target,
        proofRefs,
        decidedAt: now,
      };
    }
    return {
      id: decisionId,
      proposalId,
      decision: "deny",
      decisionReason: "policy_denied_missing_permission",
      autonomyLevel: "none",
      proofRefs,
      decidedAt: now,
    };
  }

  // 5. Owner preference blocks auto → downgrade
  if (
    context.ownerPreferenceAllowAuto === false &&
    isWriteSideEffect(proposal.sideEffectClass)
  ) {
    const target = downgradeTarget(proposal.actionKind);
    if (target) {
      return {
        id: decisionId,
        proposalId,
        decision: "downgrade",
        decisionReason: "policy_downgraded_to_draft",
        autonomyLevel: "draft_only",
        downgradedActionKind: target,
        proofRefs,
        decidedAt: now,
      };
    }
    return {
      id: decisionId,
      proposalId,
      decision: "deny",
      decisionReason: "policy_denied_missing_permission",
      autonomyLevel: "none",
      proofRefs,
      decidedAt: now,
    };
  }

  // 6. Low risk + permission + healthy affordance → allow
  if (
    proposal.riskPosture === AUTO_WRITE_MIN_RISK ||
    proposal.riskPosture === "medium"
  ) {
    if (canAutoRun(proposal.actionKind, proposal.riskPosture)) {
      return {
        id: decisionId,
        proposalId,
        decision: "allow",
        decisionReason: "policy_allowed",
        autonomyLevel: "auto_allowed",
        proofRefs,
        decidedAt: now,
      };
    }
  }

  // Default: downgrade to draft or deny
  const target = downgradeTarget(proposal.actionKind);
  if (target) {
    return {
      id: decisionId,
      proposalId,
      decision: "downgrade",
      decisionReason: "policy_downgraded_to_draft",
      autonomyLevel: "draft_only",
      downgradedActionKind: target,
      proofRefs,
      decidedAt: now,
    };
  }

  return {
    id: decisionId,
    proposalId,
    decision: "deny",
    decisionReason: "policy_denied_missing_permission",
    autonomyLevel: "none",
    proofRefs,
    decidedAt: now,
  };
}
