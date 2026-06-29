/**
 * PolicyBoundDispatch — Dispatch allowed actions and record closure-safe
 * downgraded results.
 *
 * Core logic: Read ActionPolicyDecision, route to connector or guidance
 * based on decision, and return dispatch result for closure recording.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/action-closure-policy-system.detail.md §3.3`
 * - `.anws/v8/04_SYSTEM_DESIGN/action-closure-policy-system.md §4.2`
 *
 * Dependencies:
 * - `src/core/second-nature/action/autonomy-policy-evaluator.js` (ActionPolicyDecision)
 * - `src/core/second-nature/action/action-proposal-builder.js` (ActionProposal)
 *
 * Boundary:
 * - Does not execute connector directly; returns dispatch envelope.
 * - Does not generate guidance text; returns guidance request envelope.
 * - Degrades gracefully on unavailable guidance.
 *
 * Test coverage: tests/unit/action/policy-bound-dispatch.test.ts
 */
import type { DegradedOperationResult, PlatformNeutralActionKind, V8ReasonCode } from "../../../shared/types/v8-contracts.js";
import type { ActionProposal } from "./action-proposal-builder.js";
import type { ActionPolicyDecision } from "./autonomy-policy-evaluator.js";
export interface ConnectorDispatchRequest {
    type: "connector";
    platformId: string;
    capabilityId: string;
    idempotencyKey: string;
    policyProof: {
        decisionId: string;
        decision: string;
    };
    sourceRefs: string;
    proofRefs: string;
}
export interface GuidanceDispatchRequest {
    type: "guidance";
    actionKind: PlatformNeutralActionKind;
    draftType: "reply" | "publish" | "notify";
    policyProof: {
        decisionId: string;
        decision: string;
    };
    sourceRefs: string;
    proofRefs: string;
}
export interface NoDispatchResult {
    type: "none";
    reason: V8ReasonCode;
}
export interface GuidanceUnavailableResult {
    type: "guidance_unavailable";
    downgradedActionKind: PlatformNeutralActionKind;
    reason: "guidance_unavailable";
}
export type DispatchResult = {
    type: "connector";
    request: ConnectorDispatchRequest;
} | {
    type: "guidance";
    request: GuidanceDispatchRequest;
} | NoDispatchResult | GuidanceUnavailableResult | {
    type: "degraded";
    degraded: DegradedOperationResult;
};
export interface DispatchAllowedActionOptions {
    guidanceAvailable?: boolean;
}
export declare function dispatchAllowedAction(proposal: ActionProposal, decision: ActionPolicyDecision, options?: DispatchAllowedActionOptions): DispatchResult;
