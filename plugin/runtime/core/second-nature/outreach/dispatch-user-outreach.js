import { writeDeliveryAttempt } from "../../../storage/delivery/write-delivery-attempt.js";
import { writeOperatorFallback } from "../../../storage/fallback/write-operator-fallback.js";
import { judgeOutreach } from "./judge-outreach.js";
import { resolveDeliveryTarget } from "./delivery-target.js";
import { buildOutreachDraftRequest } from "./build-outreach-draft-request.js";
function toSourceRefs(refs) {
    return refs.map((r) => ({ ...r }));
}
function hasDeliveryProof(attempt) {
    return Boolean(attempt.messageId?.trim()) || Boolean(attempt.hostProofRef);
}
function operatorReasonForUnavailable(verdict) {
    if (verdict === "target_none")
        return "target_none";
    if (verdict === "channel_missing")
        return "channel_missing";
    return "host_unsupported";
}
export async function dispatchUserOutreachIntent(input) {
    const { candidate, snapshot, judgeInput, guidance, delivery, state } = input;
    const judgment = judgeOutreach({ ...judgeInput, candidate });
    if (judgment.verdict !== "allow") {
        return {
            scope: "rhythm",
            status: judgment.verdict === "defer" ? "deferred" : "denied",
            selectedIntentId: candidate.id,
            reasons: judgment.reasons,
            decisionId: judgment.decisionId,
        };
    }
    const deliveryResolution = resolveDeliveryTarget(judgeInput.delivery);
    if (deliveryResolution.verdict !== "target_available") {
        const req = buildOutreachDraftRequest(candidate, judgment, snapshot, deliveryResolution);
        const draft = await guidance.draftOutreachMessage(req);
        const fb = await writeOperatorFallback(state, {
            reason: operatorReasonForUnavailable(deliveryResolution.verdict),
            decisionId: judgment.decisionId,
            sourceRefs: toSourceRefs(judgment.sourceRefs),
            candidateMessage: draft.status === "ready" ? draft.draft.text : undefined,
            nextStep: "resolve_delivery_target_or_retry_after_host_update",
        });
        return {
            scope: "rhythm",
            status: "delivery_unavailable",
            selectedIntentId: candidate.id,
            reasons: [deliveryResolution.reason],
            decisionId: judgment.decisionId,
            fallbackRef: fb.fallbackRef,
        };
    }
    const req = buildOutreachDraftRequest(candidate, judgment, snapshot, deliveryResolution);
    const draft = await guidance.draftOutreachMessage(req);
    if (draft.status !== "ready") {
        return {
            scope: "rhythm",
            status: "denied",
            selectedIntentId: candidate.id,
            reasons: draft.reasons,
            decisionId: judgment.decisionId,
        };
    }
    const attempt = await delivery.sendDeliveryRequest({
        decisionId: judgment.decisionId,
        target: deliveryResolution.target,
        channel: deliveryResolution.channel,
        recipient: deliveryResolution.recipient,
        message: draft.draft.text,
        sourceRefs: judgment.sourceRefs,
    });
    if (attempt.status !== "sent" || !hasDeliveryProof(attempt)) {
        const fb = await writeOperatorFallback(state, {
            reason: "delivery_failed",
            decisionId: judgment.decisionId,
            sourceRefs: toSourceRefs(judgment.sourceRefs),
            candidateMessage: draft.draft.text,
            nextStep: "review_delivery_audit_and_host_capability",
        });
        const hostReportedSentWithoutProof = attempt.status === "sent" && !hasDeliveryProof(attempt);
        await writeDeliveryAttempt(state, {
            attemptId: attempt.id,
            decisionId: judgment.decisionId,
            target: deliveryResolution.target,
            channel: deliveryResolution.channel,
            status: attempt.status === "dropped_by_host_policy" ? "dropped_by_host_policy" : "failed",
            errorClass: hostReportedSentWithoutProof
                ? "delivery_proof_missing"
                : attempt.errorClass ?? attempt.status,
            fallbackRef: fb.fallbackRef,
        });
        return {
            scope: "rhythm",
            status: "delivery_unavailable",
            selectedIntentId: candidate.id,
            reasons: hostReportedSentWithoutProof
                ? ["delivery_failed", "delivery_proof_missing"]
                : ["delivery_failed", attempt.status],
            decisionId: judgment.decisionId,
            deliveryAttemptId: attempt.id,
            fallbackRef: fb.fallbackRef,
        };
    }
    await writeDeliveryAttempt(state, {
        attemptId: attempt.id,
        decisionId: judgment.decisionId,
        target: deliveryResolution.target,
        channel: deliveryResolution.channel,
        status: "sent",
        messageId: attempt.messageId?.trim(),
        hostProofRef: attempt.hostProofRef,
    });
    return {
        scope: "rhythm",
        status: "intent_selected",
        selectedIntentId: candidate.id,
        reasons: ["outreach_sent"],
        decisionId: judgment.decisionId,
        deliveryAttemptId: attempt.id,
    };
}
