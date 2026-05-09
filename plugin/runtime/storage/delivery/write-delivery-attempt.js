import { deliveryAttempts } from "../db/schema/delivery-attempts.js";
function assertDeliveryAttemptValid(attempt) {
    if (attempt.status === "sent") {
        const hasProof = Boolean(attempt.messageId?.trim()) || Boolean(attempt.hostProofRef);
        if (!hasProof) {
            throw new Error("delivery_attempt_sent_requires_message_id_or_host_proof_ref");
        }
    }
    if (attempt.status === "failed" || attempt.status === "dropped_by_host_policy") {
        const hasDiag = Boolean(attempt.errorClass?.trim()) || Boolean(attempt.fallbackRef?.trim());
        if (!hasDiag) {
            throw new Error("delivery_attempt_failed_requires_error_class_or_fallback_ref");
        }
    }
}
export async function writeDeliveryAttempt(state, attempt) {
    assertDeliveryAttemptValid(attempt);
    const createdAt = new Date().toISOString();
    await state.db.insert(deliveryAttempts).values({
        attemptId: attempt.attemptId,
        decisionId: attempt.decisionId,
        target: attempt.target ?? null,
        channel: attempt.channel ?? null,
        status: attempt.status,
        messageId: attempt.messageId ?? null,
        hostProofRefJson: attempt.hostProofRef ? JSON.stringify(attempt.hostProofRef) : null,
        errorClass: attempt.errorClass ?? null,
        fallbackRef: attempt.fallbackRef ?? null,
        createdAt,
    });
    return {
        attemptId: attempt.attemptId,
        status: attempt.status,
        fallbackRef: attempt.fallbackRef,
    };
}
