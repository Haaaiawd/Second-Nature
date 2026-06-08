/**
 * GuidanceProposalConsumer — Consume policy-downgraded proposals and
 * produce owner-visible draft/notify outputs.
 *
 * Core logic: Read an ActionPolicyDecision with downgrade, map to
 * guidance request shape, and return owner-visible output without
 * executing external write.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/guidance-voice-system.md`
 * - `.anws/v8/04_SYSTEM_DESIGN/action-closure-policy-system.detail.md §3.3`
 *
 * Dependencies:
 * - `src/core/second-nature/action/autonomy-policy-evaluator.js` (ActionPolicyDecision)
 * - `src/shared/types/v8-contracts.js` (PlatformNeutralActionKind)
 *
 * Boundary:
 * - Does not generate actual text; returns guidance request envelope.
 * - Does not execute connector; only produces draft/notify intent.
 * - Degrades gracefully on missing decision.
 *
 * Test coverage: tests/unit/guidance/guidance-proposal-consumer.test.ts
 */
import type { ActionPolicyDecision } from "../action/autonomy-policy-evaluator.js";
import type { ActionProposal } from "../action/action-proposal-builder.js";
import type { PlatformNeutralActionKind, SourceRef, DegradedOperationResult, V8ReasonCode } from "../../../shared/types/v8-contracts.js";
export interface GuidanceOutput {
    id: string;
    mode: "draft" | "notify";
    textRef: SourceRef;
    sourceRefs: SourceRef[];
    deliveryClaim: "not_delivered";
    decisionId: string;
    actionKind: PlatformNeutralActionKind;
    ownerVisible: boolean;
}
export type GuidanceValidationResult = {
    ok: true;
} | {
    ok: false;
    reason: V8ReasonCode;
    sourceRefs: SourceRef[];
};
export type ConsumeGuidanceProposalResult = {
    ok: true;
    output: GuidanceOutput;
} | {
    ok: false;
    degraded: DegradedOperationResult;
};
export declare function consumeGuidanceProposal(proposal: ActionProposal, decision: ActionPolicyDecision): ConsumeGuidanceProposalResult;
