/**
 * v9 ActionProposalBuilder — Convert Agent intent, ActivityStep intent,
 * RoutineInvocation and AttentionSignal refs into v9 ActionProposal.
 *
 * Core logic:
 * - Agent-authored intent directly selects action kind and target.
 * - ActivityStep intent (propose_action / policy_closure) becomes a proposal
 *   only when the step carries an authored action kind.
 * - RoutineInvocation produces a routine proposal with routine id/version.
 * - AttentionSignal refs are used only for grounding/source attribution,
 *   never as action author.
 * - `ignore` / `watch` / `remember` return no-action; side-effecting actions
 *   without source refs are blocked.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/action-closure-policy-system.md §5.1`
 * - `.anws/v9/04_SYSTEM_DESIGN/action-closure-policy-system.detail.md §2.1 §3.1 §4.1`
 * - `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md §6`
 * - ADR-002: Attention is not Agent mind.
 * - ADR-005: Procedural memory as verified routine.
 *
 * Dependencies:
 * - `src/shared/types/v9-contracts.js` (canonical v9 action contracts)
 *
 * Boundary:
 * - Does not evaluate policy; only builds proposal payload.
 * - Does not execute connector calls or generate guidance text.
 * - Does not bypass action-closure-policy; ActivityThread steps remain
 *   policy-bound.
 *
 * Test coverage: `tests/unit/action/v9-action-proposal-builder.test.ts`
 */

import {
  type ActionProposal,
  type ActionSideEffectClass,
  type ActivityStep,
  type ActivityStepKind,
  type AgentActionIntent,
  type AttentionActionKind,
  type AttentionSignalRef,
  type PlatformNeutralActionKind,
  type RoutineInvocation,
  type SourceRef,
  type ToolRoutineReadModel,
  type V9ReasonCode,
  V9_ACTION_KIND_REGISTRY,
  parseToolRoutineGuardSchema,
} from "../../../shared/types/v9-contracts.js";

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

/**
 * ActivityStepIntent represents an ActivityStep that has been authored by
 * Agent or verified routine and carries a concrete action proposal.
 * Not every ActivityStep is an intent; only `propose_action` or
 * `policy_closure` steps that have been authored can cross into the
 * action-closure-policy-system.
 */
export interface ActivityStepIntent extends ActivityStep {
  authoredBy: "agent" | "routine";
  proposedActionKind?: PlatformNeutralActionKind;
  targetPlatformId?: string;
  targetCapabilityId?: string;
}

export interface BuildV9ActionProposalInput {
  cycleId: string;
  agentIntent?: AgentActionIntent;
  activityStepIntent?: ActivityStepIntent;
  routineReadModel?: ToolRoutineReadModel;
  attentionRefs: AttentionSignalRef[];
  now?: string;
}

export interface V9NoActionResult {
  status: "no_action";
  reason: V9ReasonCode;
}

export type BuildV9ActionProposalResult =
  | { status: "proposal"; proposal: ActionProposal }
  | V9NoActionResult;

// ───────────────────────────────────────────────────────────────
// Constants
// ───────────────────────────────────────────────────────────────

const ACTION_ATTENTION_KINDS: AttentionActionKind[] = [
  "notify_owner",
  "watch",
  "remember",
  "defer",
];

export const MAX_PROPOSALS_PER_CYCLE = 8;

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

function generateId(prefix: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "");
  return `${prefix}_${ts}_${Math.random().toString(36).slice(2, 8)}`;
}

function dedupeSourceRefs(refs: SourceRef[]): SourceRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.family}:${ref.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function classifySideEffect(
  actionKind: PlatformNeutralActionKind,
): ActionSideEffectClass {
  return V9_ACTION_KIND_REGISTRY[actionKind]?.sideEffectClass ?? "none";
}

function inferTargetFromAttention(
  refs: AttentionSignalRef[],
): { platformId?: string; capabilityId?: string } {
  for (const ref of refs) {
    if (ref.platformId) {
      return { platformId: ref.platformId, capabilityId: ref.capabilityId };
    }
  }
  return {};
}

function computeRiskPosture(
  actionKind: PlatformNeutralActionKind,
  attentionRefs: AttentionSignalRef[],
): ActionProposal["riskPosture"] {
  // Any attention ref signalling high risk elevates the proposal.
  if (attentionRefs.some((r) => r.rationale?.includes("high_risk"))) {
    return "high";
  }
  const meta = V9_ACTION_KIND_REGISTRY[actionKind];
  if (meta?.sideEffectClass === "external_write") return "medium";
  if (meta?.sideEffectClass === "routine") return "medium";
  if (meta?.sideEffectClass === "owner_attention") return "low";
  return "low";
}

function buildIdempotencyKey(
  cycleId: string,
  agentIntent: AgentActionIntent | undefined,
  activityStepIntent: ActivityStepIntent | undefined,
): string {
  if (agentIntent) {
    return `idem_${cycleId}_${agentIntent.intentId}`;
  }
  if (activityStepIntent) {
    return `idem_${cycleId}_${activityStepIntent.stepId}`;
  }
  return `idem_${cycleId}_attention_only`;
}

function attentionKindToPlatformKind(
  kind: AttentionActionKind,
): PlatformNeutralActionKind | undefined {
  if (kind === "defer") return "watch";
  return ACTION_ATTENTION_KINDS.includes(kind) ? kind : undefined;
}

function deriveKindFromAttention(
  attentionRefs: AttentionSignalRef[],
): PlatformNeutralActionKind | undefined {
  for (const ref of attentionRefs) {
    const mapped = attentionKindToPlatformKind(ref.selectedActionKind);
    if (mapped) return mapped;
  }
  return undefined;
}

function isExecutableStepKind(stepKind: ActivityStepKind): boolean {
  return stepKind === "propose_action" || stepKind === "policy_closure";
}

// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────

export function buildV9ActionProposal(
  input: BuildV9ActionProposalInput,
): BuildV9ActionProposalResult {
  const {
    cycleId,
    agentIntent,
    activityStepIntent,
    routineReadModel,
    attentionRefs,
    now: nowInput,
  } = input;
  const now = nowInput ?? new Date().toISOString();

  // 1. Resolve action kind and authorship source.
  let selectedKind: PlatformNeutralActionKind | undefined;
  let targetPlatformId: string | undefined;
  let targetCapabilityId: string | undefined;
  let capabilityPattern: string | undefined;
  let triggerCapabilities: string[] | undefined;
  let intentSourceRefs: SourceRef[] = [];
  let routineInvocationId: string | undefined;
  let routineVersion: string | undefined;

  if (agentIntent) {
    selectedKind = agentIntent.actionKind;
    targetPlatformId = agentIntent.targetPlatformId;
    targetCapabilityId = agentIntent.targetCapabilityId;
    intentSourceRefs = agentIntent.sourceRefs;

    if (agentIntent.routineInvocation) {
      selectedKind = "routine";
      targetCapabilityId =
        agentIntent.routineInvocation.capabilityPattern ??
        agentIntent.targetCapabilityId;
      capabilityPattern = agentIntent.routineInvocation.capabilityPattern;
      triggerCapabilities = agentIntent.routineInvocation.triggerCapabilities;
      routineInvocationId = agentIntent.routineInvocation.routineId;
      routineVersion = agentIntent.routineInvocation.version;
      intentSourceRefs = dedupeSourceRefs([
        ...intentSourceRefs,
        ...agentIntent.routineInvocation.sourceRefs,
      ]);
    }
  } else if (activityStepIntent && isExecutableStepKind(activityStepIntent.stepKind)) {
    if (
      activityStepIntent.authoredBy !== "agent" &&
      activityStepIntent.authoredBy !== "routine"
    ) {
      return {
        status: "no_action",
        reason: "attention_hint_without_agent_or_routine_intent",
      };
    }
    selectedKind =
      activityStepIntent.proposedActionKind ??
      deriveKindFromAttention(attentionRefs);
    targetPlatformId = activityStepIntent.targetPlatformId;
    targetCapabilityId = activityStepIntent.targetCapabilityId;
    intentSourceRefs = activityStepIntent.sourceRefs;
  }

  // Attention-only path: AttentionSignal refs cannot author a proposal.
  if (!selectedKind) {
    return {
      status: "no_action",
      reason: "attention_hint_without_agent_or_routine_intent",
    };
  }

  // Non-actionable kinds produce no proposal.
  if (selectedKind === "ignore" || selectedKind === "watch") {
    return { status: "no_action", reason: "proposal_no_action" };
  }
  if (selectedKind === "remember") {
    return { status: "no_action", reason: "proposal_no_action" };
  }

  // 2. Resolve target from attention refs if not explicitly set.
  if (!targetPlatformId && attentionRefs.length > 0) {
    const inferred = inferTargetFromAttention(attentionRefs);
    targetPlatformId = inferred.platformId;
    targetCapabilityId = inferred.capabilityId ?? targetCapabilityId;
  }

  // 3. Classify side effect and compute risk.
  const sideEffectClass = classifySideEffect(selectedKind);

  // 4. Merge and deduplicate source refs.
  const attentionSourceRefs = attentionRefs.flatMap((r) => r.sourceRefs);
  const routineSourceRefs = routineReadModel?.sourceRefs ?? [];
  const sourceRefs = dedupeSourceRefs([
    ...intentSourceRefs,
    ...attentionSourceRefs,
    ...routineSourceRefs,
  ]);

  // 5. Source ref gate: side-effecting proposals must be grounded.
  if (sourceRefs.length === 0 && sideEffectClass !== "none") {
    return {
      status: "no_action",
      reason: "policy_denied_missing_sources",
    };
  }

  // 6. Build canonical v9 ActionProposal.
  const riskPosture = computeRiskPosture(selectedKind, attentionRefs);
  const reason: V9ReasonCode = "proposal_created";

  // Parse routine guard schema if present.
  let guard: ActionProposal["guard"];
  if (selectedKind === "routine") {
    const guardInput =
      agentIntent?.routineInvocation?.guardSchemaJson ??
      routineReadModel?.guardSchemaJson;
    const parsed = parseToolRoutineGuardSchema(guardInput);
    if (parsed.ok) {
      guard = parsed.guard;
    }
    // Fall back to read model for routine provenance when invocation omitted it.
    if (!capabilityPattern && routineReadModel?.capabilityPattern) {
      capabilityPattern = routineReadModel.capabilityPattern;
    }
    if (!triggerCapabilities?.length && routineReadModel?.triggerCapabilities) {
      triggerCapabilities = routineReadModel.triggerCapabilities;
    }
  }

  const proposal: ActionProposal = {
    id: generateId("prop"),
    cycleId,
    actionKind: selectedKind,
    targetPlatformId,
    targetCapabilityId,
    capabilityPattern,
    triggerCapabilities,
    sourceRefs,
    proofRefs: [],
    reason,
    riskPosture,
    sideEffectClass,
    idempotencyKey: buildIdempotencyKey(
      cycleId,
      agentIntent,
      activityStepIntent,
    ),
    routineInvocationId,
    routineVersion,
    guard,
    createdAt: now,
  };

  return { status: "proposal", proposal };
}

// ───────────────────────────────────────────────────────────────
// Batch builder
// ───────────────────────────────────────────────────────────────

export interface BatchBuildV9ProposalResult {
  proposals: ActionProposal[];
  noActions: V9NoActionResult[];
}

export function buildV9ActionProposals(
  inputs: BuildV9ActionProposalInput[],
): BatchBuildV9ProposalResult {
  const proposals: ActionProposal[] = [];
  const noActions: V9NoActionResult[] = [];

  for (const input of inputs) {
    if (proposals.length >= MAX_PROPOSALS_PER_CYCLE) {
      noActions.push({
        status: "no_action",
        reason: "no_actionable_intent",
      });
      continue;
    }

    const result = buildV9ActionProposal(input);
    if (result.status === "proposal") {
      proposals.push(result.proposal);
    } else {
      noActions.push(result);
    }
  }

  return { proposals, noActions };
}
