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
  type ActionSideEffectClass,
  type PlatformNeutralActionKind,
  type PolicyEvaluationContext,
  type RoutineRegistryStatus,
  type SourceRef,
  type V9ReasonCode,
  V9_ACTION_KIND_REGISTRY,
  parseToolRoutineGuardSchema,
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

const SIDE_EFFECT_CLASS_RANK: Record<
  "none" | "owner_attention" | "external_write",
  number
> = {
  none: 0,
  owner_attention: 1,
  external_write: 2,
};

function matchesCapabilityPattern(
  capabilityId: string,
  pattern: string,
): boolean {
  if (pattern === capabilityId) return true;
  // Simple glob support: "*" matches any segment, "?" matches single char.
  const regex = new RegExp(
    "^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
  );
  return regex.test(capabilityId);
}

function isCapabilityInTriggerSet(
  capabilityId: string,
  triggerCapabilities: string[] | undefined,
  capabilityPattern: string | undefined,
): boolean {
  if (triggerCapabilities?.some((tc) => tc === capabilityId)) return true;
  if (capabilityPattern && matchesCapabilityPattern(capabilityId, capabilityPattern)) return true;
  return false;
}

/**
 * Infer the side-effect class ceiling of a capability from its id.
 * This is an interim heuristic until T6.2.2 provides a capability metadata registry.
 */
function inferCapabilitySideEffectClass(
  capabilityId: string,
): "none" | "owner_attention" | "external_write" {
  const lastSegment = capabilityId.split(":").pop() ?? "";
  const actionHint = lastSegment.split(".").pop() ?? "";
  const writeHints = new Set([
    "write",
    "claim",
    "publish",
    "reply",
    "send",
    "post",
    "create",
    "update",
    "delete",
    "submit",
  ]);
  const notifyHints = new Set(["notify", "alert", "remind", "prompt"]);
  if (writeHints.has(actionHint)) return "external_write";
  if (notifyHints.has(actionHint)) return "owner_attention";
  return "owner_attention"; // read/search/inspect default to owner-attention ceiling
}

function maxOfTriggerCapabilities(
  triggerCapabilities: string[] | undefined,
  capabilityPattern: string | undefined,
  targetCapabilityId: string | undefined,
): "none" | "owner_attention" | "external_write" {
  const candidates: string[] = [];
  if (triggerCapabilities?.length) candidates.push(...triggerCapabilities);
  if (capabilityPattern) candidates.push(capabilityPattern);
  if (targetCapabilityId && candidates.length === 0) candidates.push(targetCapabilityId);

  if (candidates.length === 0) return "none";

  let maxRank = 0;
  for (const cap of candidates) {
    const cls = inferCapabilitySideEffectClass(cap);
    maxRank = Math.max(maxRank, SIDE_EFFECT_CLASS_RANK[cls]);
  }
  if (maxRank >= 2) return "external_write";
  if (maxRank >= 1) return "owner_attention";
  return "none";
}

function evaluateRoutineGuard(
  proposal: ActionProposal,
  context: EvaluateV9ActionPolicyContext,
): { decision?: ActionPolicyDecision["decision"]; reason?: V9ReasonCode; autonomyLevel?: ActionPolicyDecision["autonomyLevel"]; downgradedActionKind?: PlatformNeutralActionKind } {
  const targetCapabilityId = proposal.targetCapabilityId;
  const triggerCapabilities = proposal.triggerCapabilities;
  const capabilityPattern = proposal.capabilityPattern;

  // Missing or unparseable guard schema is a policy denial.
  if (!proposal.guard) {
    return { decision: "deny", reason: "routine_guard_policy_denied", autonomyLevel: "none" };
  }
  const guard = proposal.guard;

  // Guard schema structural validation (should already be parsed, but re-validate defensively).
  const parsed = parseToolRoutineGuardSchema(guard);
  if (!parsed.ok) {
    return { decision: "deny", reason: "routine_guard_schema_invalid", autonomyLevel: "none" };
  }

  // Permission expansion: allowed capabilities must not exceed the routine's trigger provenance.
  const expansionCheckTarget = targetCapabilityId ?? capabilityPattern;
  if (expansionCheckTarget) {
    const expandsCapability = guard.allowedCapabilities.some(
      (cap) => !isCapabilityInTriggerSet(cap, triggerCapabilities, capabilityPattern),
    );
    if (expandsCapability) {
      return { decision: "deny", reason: "routine_permission_expansion_denied", autonomyLevel: "none" };
    }
  }

  // Denied capability list blocks invocation of any matching capability.
  const deniedMatch = guard.deniedCapabilities.find(
    (cap) =>
      cap === targetCapabilityId ||
      cap === capabilityPattern ||
      isCapabilityInTriggerSet(cap, triggerCapabilities, capabilityPattern),
  );
  if (deniedMatch) {
    return { decision: "deny", reason: "routine_guard_policy_denied", autonomyLevel: "none" };
  }

  // Side-effect class ceiling: guard may not claim a higher side-effect class than the
  // routine's trigger capability provenance.
  const triggerMaxClass = maxOfTriggerCapabilities(
    triggerCapabilities,
    capabilityPattern,
    targetCapabilityId,
  );
  if (
    SIDE_EFFECT_CLASS_RANK[guard.maxSideEffectClass] >
    SIDE_EFFECT_CLASS_RANK[triggerMaxClass]
  ) {
    return { decision: "deny", reason: "routine_permission_expansion_denied", autonomyLevel: "none" };
  }

  // Invocation-time policy context for external_write ceiling.
  if (
    guard.maxSideEffectClass === "external_write" &&
    (!context.platformPermissionDeclared || !context.circuitBreakerClosed || !context.ownerPreference)
  ) {
    return { decision: "deny", reason: "routine_guard_policy_denied", autonomyLevel: "none" };
  }

  // owner_attention ceiling requires owner preference.
  if (
    guard.maxSideEffectClass === "owner_attention" &&
    !context.ownerPreference
  ) {
    return { decision: "deny", reason: "routine_guard_policy_denied", autonomyLevel: "none" };
  }

  // requiresOwnerConfirm overrides autonomy to owner_confirm.
  if (guard.requiresOwnerConfirm) {
    const target = downgradeTarget(proposal.actionKind);
    return {
      decision: "downgrade",
      reason: "policy_downgraded_to_draft",
      autonomyLevel: "owner_confirm",
      downgradedActionKind: target,
    };
  }

  return {};
}

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
    return decision("deny", "policy_denied_missing_sources", "none");
  }

  // 2. Risk blocked → deny.
  if (proposal.riskPosture === "blocked") {
    return decision("deny", "policy_denied_high_risk", "none");
  }

  // 3. Routine proposal → active + guard evaluation required.
  if (proposal.sideEffectClass === "routine") {
    if (context.routineStatus !== "active") {
      return decision("deny", "routine_invocation_denied", "none");
    }

    const guardResult = evaluateRoutineGuard(proposal, context);
    if (guardResult.decision) {
      return decision(
        guardResult.decision,
        guardResult.reason ?? "routine_guard_policy_denied",
        guardResult.autonomyLevel ?? "none",
        guardResult.downgradedActionKind,
      );
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
