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
import { serializeSourceRefs } from "../../../shared/serialization.js";
// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────
function inferGuidanceDraftType(actionKind) {
    if (actionKind === "draft_reply" || actionKind === "auto_reply")
        return "reply";
    if (actionKind === "draft_publish" || actionKind === "auto_publish")
        return "publish";
    return "notify";
}
// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────
export function dispatchAllowedAction(proposal, decision, options) {
    // deny / defer → no dispatch
    if (decision.decision === "deny") {
        return { type: "none", reason: decision.decisionReason };
    }
    if (decision.decision === "defer") {
        return { type: "none", reason: decision.decisionReason };
    }
    // downgrade → guidance only (no external write)
    if (decision.decision === "downgrade") {
        const target = decision.downgradedActionKind ?? proposal.actionKind;
        const draftType = inferGuidanceDraftType(target);
        // If guidance is unavailable, return closure-safe downgrade result
        if (options?.guidanceAvailable === false) {
            return {
                type: "guidance_unavailable",
                downgradedActionKind: target,
                reason: "guidance_unavailable",
            };
        }
        return {
            type: "guidance",
            request: {
                type: "guidance",
                actionKind: target,
                draftType,
                policyProof: { decisionId: decision.id, decision: decision.decision },
                sourceRefs: serializeSourceRefs(decision.proofRefs),
            },
        };
    }
    // allow → route by action kind
    if (decision.decision === "allow") {
        if (proposal.actionKind === "run_connector") {
            return {
                type: "connector",
                request: {
                    type: "connector",
                    platformId: proposal.targetPlatformId ?? "connector",
                    capabilityId: proposal.targetCapabilityId ?? "run_connector",
                    idempotencyKey: proposal.idempotencyKey,
                    policyProof: { decisionId: decision.id, decision: decision.decision },
                    sourceRefs: serializeSourceRefs(proposal.sourceRefs),
                },
            };
        }
        if (proposal.actionKind === "auto_reply" ||
            proposal.actionKind === "auto_publish" ||
            proposal.actionKind === "draft_reply" ||
            proposal.actionKind === "draft_publish") {
            const draftType = inferGuidanceDraftType(proposal.actionKind);
            return {
                type: "guidance",
                request: {
                    type: "guidance",
                    actionKind: proposal.actionKind,
                    draftType,
                    policyProof: { decisionId: decision.id, decision: decision.decision },
                    sourceRefs: serializeSourceRefs(proposal.sourceRefs),
                },
            };
        }
        // notify_owner / remember / watch / ignore — no external dispatch needed
        return { type: "none", reason: decision.decisionReason };
    }
    return {
        type: "degraded",
        degraded: {
            status: "degraded",
            reason: "closure_failed",
            ownerStage: "execution",
            sourceRefs: decision.proofRefs,
            operatorNextAction: "Unexpected policy decision shape",
            retryable: false,
        },
    };
}
