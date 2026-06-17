/**
 * ActionProposalBuilder — Convert JudgmentVerdict into ActionProposal.
 *
 * Core logic: Read a verdict, map action kind to side-effect class and
 * expected output, and write an ActionProposal row. For `remember` verdicts,
 * emit a MemoryReviewCandidateClosure instead of an executable proposal.
 * For `ignore` / `watch`, return a no-action result.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/action-closure-policy-system.detail.md §3.1`
 * - `.anws/v8/04_SYSTEM_DESIGN/action-closure-policy-system.md §4.2`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (readJudgmentVerdictById, writeActionClosureRecord)
 * - `src/shared/types/v8-contracts.js` (PlatformNeutralActionKind, SourceRef,
 *   DegradedOperationResult, V8ReasonCode, ACTION_KIND_REGISTRY)
 *
 * Boundary:
 * - Does not evaluate policy; only builds proposal payload.
 * - Does not write long-term memory on `remember`; emits review intent only.
 * - Degrades gracefully on missing verdict or unreadable state.
 *
 * Test coverage: tests/unit/action/action-proposal-builder.test.ts
 */
import { readJudgmentVerdictById, } from "../../../storage/v8-state-stores.js";
import { parseSourceRefs } from "../../../shared/serialization.js";
import { ACTION_KIND_REGISTRY } from "../../../shared/types/v8-contracts.js";
// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────
function buildExpectedOutput(actionKind) {
    switch (actionKind) {
        case "ignore":
            return "No action required";
        case "watch":
            return "Monitor for changes";
        case "remember":
            return "Queue for daily review";
        case "notify_owner":
            return "Send owner notification";
        case "draft_reply":
            return "Generate reply draft";
        case "auto_reply":
            return "Send automated reply";
        case "draft_publish":
            return "Generate publish draft";
        case "auto_publish":
            return "Publish to platform";
        case "run_connector":
            return "Execute connector capability";
        default:
            return "Unknown action";
    }
}
function inferTargetPlatform(actionKind) {
    if (actionKind === "run_connector") {
        return { platformId: "connector", capabilityId: "run_connector" };
    }
    return {};
}
// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────
export async function buildActionProposal(db, judgmentVerdictId, options) {
    const now = options?.now ?? new Date().toISOString();
    const readResult = await readJudgmentVerdictById(db, judgmentVerdictId);
    if (readResult.degraded) {
        return readResult.degraded;
    }
    const verdict = readResult.row;
    if (!verdict) {
        return {
            status: "degraded",
            reason: "state_unreadable",
            ownerStage: "policy",
            sourceRefs: [],
            operatorNextAction: `JudgmentVerdict ${judgmentVerdictId} not found`,
            retryable: false,
        };
    }
    const actionKind = verdict.actionKind;
    const cycleId = verdict.cycleId;
    // ignore / watch → no-action
    if (actionKind === "ignore" || actionKind === "watch") {
        return {
            status: "no_action",
            reason: "proposal_no_action",
            cycleId,
            judgmentVerdictId,
        };
    }
    const sourceRefs = parseSourceRefs(verdict.sourceRefsJson);
    // remember → memory review candidate (no direct projection; orchestrator writes closure)
    if (actionKind === "remember") {
        const candidate = {
            closureSubtype: "remember_for_review",
            perceptionRef: {
                uri: `sn://perception/${verdict.perceptionCardId}`,
                family: "perception",
                id: verdict.perceptionCardId,
                redactionClass: "none",
                resolveStatus: "resolvable",
            },
            judgmentVerdictRef: {
                uri: `sn://judgment/${judgmentVerdictId}`,
                family: "judgment",
                id: judgmentVerdictId,
                redactionClass: "none",
                resolveStatus: "resolvable",
            },
            topicKey: verdict.perceptionCardId,
            memoryIntentReason: verdict.reason ?? "remember",
            reviewPriority: "medium",
            sourceRefs: (sourceRefs.length > 0 ? sourceRefs : [
                {
                    uri: `sn://proposal/remember/${judgmentVerdictId}`,
                    family: "action_closure",
                    id: judgmentVerdictId,
                    redactionClass: "none",
                    resolveStatus: "resolvable",
                },
            ]),
        };
        return {
            status: "remember_for_review",
            memoryReviewCandidate: candidate,
            closureId: `cls_remember_${judgmentVerdictId}_${now.replace(/[:.]/g, "")}`,
        };
    }
    // Actionable verdict → build proposal
    const meta = ACTION_KIND_REGISTRY[actionKind];
    const { platformId, capabilityId } = inferTargetPlatform(actionKind);
    const proposal = {
        id: `prop_${judgmentVerdictId}_${now.replace(/[:.]/g, "")}`,
        cycleId,
        judgmentVerdictId,
        actionKind,
        targetPlatformId: platformId,
        targetCapabilityId: capabilityId,
        sourceRefs: sourceRefs.length > 0 ? sourceRefs : [
            {
                uri: `sn://proposal/${judgmentVerdictId}`,
                family: "action_closure",
                id: judgmentVerdictId,
                redactionClass: "none",
                resolveStatus: "resolvable",
            },
        ],
        reason: verdict.reason ?? "proposal_created",
        riskPosture: verdict.riskPosture ?? "low",
        expectedOutput: buildExpectedOutput(actionKind),
        sideEffectClass: meta?.sideEffectClass ?? "none",
        idempotencyKey: `idem_${cycleId}_${judgmentVerdictId}`,
        createdAt: now,
    };
    return {
        status: "proposal",
        proposal,
    };
}
export async function buildActionProposals(db, judgmentVerdictIds, options) {
    const proposals = [];
    const noActions = [];
    const rememberForReviews = [];
    const failed = [];
    for (const judgmentVerdictId of judgmentVerdictIds) {
        const result = await buildActionProposal(db, judgmentVerdictId, options);
        if ("status" in result && result.status === "proposal") {
            proposals.push(result.proposal);
        }
        else if ("status" in result && result.status === "no_action") {
            noActions.push(result);
        }
        else if ("status" in result && result.status === "remember_for_review") {
            rememberForReviews.push(result);
        }
        else if ("status" in result && result.status === "degraded") {
            failed.push({
                judgmentVerdictId,
                degraded: result,
            });
        }
        else {
            failed.push({
                judgmentVerdictId,
                degraded: result,
            });
        }
    }
    return { proposals, noActions, rememberForReviews, failed };
}
