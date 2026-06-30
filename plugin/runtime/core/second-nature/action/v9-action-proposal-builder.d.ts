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
import { type ActionProposal, type ActivityStep, type AgentActionIntent, type AttentionSignalRef, type PlatformNeutralActionKind, type ToolRoutineReadModel, type V9ReasonCode } from "../../../shared/types/v9-contracts.js";
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
export type BuildV9ActionProposalResult = {
    status: "proposal";
    proposal: ActionProposal;
} | V9NoActionResult;
export declare const MAX_PROPOSALS_PER_CYCLE = 8;
export declare function buildV9ActionProposal(input: BuildV9ActionProposalInput): BuildV9ActionProposalResult;
export interface BatchBuildV9ProposalResult {
    proposals: ActionProposal[];
    noActions: V9NoActionResult[];
}
export declare function buildV9ActionProposals(inputs: BuildV9ActionProposalInput[]): BatchBuildV9ProposalResult;
