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
// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────
function validateSourceRefs(proposalRefs, proofRefs) {
    // Proposal must have at least one source ref
    if (proposalRefs.length === 0) {
        return {
            ok: false,
            reason: "source_refs_unresolved",
            sourceRefs: [],
        };
    }
    const allRefs = [...proposalRefs, ...proofRefs];
    const unresolved = allRefs.filter((r) => r.resolveStatus === "missing" || r.resolveStatus === "permission_denied");
    if (unresolved.length > 0) {
        return {
            ok: false,
            reason: "source_refs_unresolved",
            sourceRefs: unresolved,
        };
    }
    return { ok: true };
}
function buildGuidanceOutput(proposal, decision) {
    const actionKind = decision.downgradedActionKind ?? proposal.actionKind;
    let mode = "notify";
    if (actionKind === "draft_reply" || actionKind === "auto_reply") {
        mode = "draft";
    }
    else if (actionKind === "draft_publish" || actionKind === "auto_publish") {
        mode = "draft";
    }
    else if (actionKind === "notify_owner") {
        mode = "notify";
    }
    const textRef = {
        uri: `sn://guidance/${proposal.id}`,
        family: "action_closure",
        id: proposal.id,
        redactionClass: "none",
        sensitivityClass: proposal.sourceRefs[0]?.sensitivityClass ?? "public_general",
        resolveStatus: "resolvable",
    };
    return {
        id: `guidance_${decision.id}_${Date.now()}`,
        mode,
        textRef,
        sourceRefs: proposal.sourceRefs,
        proofRefs: decision.proofRefs,
        deliveryClaim: "not_delivered",
        decisionId: decision.id,
        actionKind,
        ownerVisible: true,
    };
}
// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────
export function consumeGuidanceProposal(proposal, decision) {
    // Only consume allowed or downgraded proposals
    if (decision.decision !== "downgrade" && decision.decision !== "allow") {
        return {
            ok: false,
            degraded: {
                status: "blocked",
                reason: "policy_denied_high_risk",
                ownerStage: "execution",
                sourceRefs: decision.proofRefs,
                operatorNextAction: "Review policy decision before requesting guidance",
                retryable: false,
            },
        };
    }
    // Validate source refs
    const validation = validateSourceRefs(proposal.sourceRefs, decision.proofRefs);
    if (!validation.ok) {
        return {
            ok: false,
            degraded: {
                status: "blocked",
                reason: validation.reason,
                ownerStage: "execution",
                sourceRefs: validation.sourceRefs,
                operatorNextAction: "Fix unresolved source refs in proposal or decision proof",
                retryable: true,
            },
        };
    }
    const output = buildGuidanceOutput(proposal, decision);
    return { ok: true, output };
}
