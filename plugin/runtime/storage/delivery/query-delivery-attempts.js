/**
 * Read models for delivery attempts by decisionId (T4.3.1).
 */
import { eq } from "drizzle-orm";
import { deliveryAttempts } from "../db/schema/delivery-attempts.js";
function rowToRecord(row) {
    let hostProofRef;
    if (row.hostProofRefJson) {
        try {
            hostProofRef = JSON.parse(row.hostProofRefJson);
        }
        catch {
            hostProofRef = undefined;
        }
    }
    return {
        attemptId: row.attemptId,
        decisionId: row.decisionId,
        target: row.target ?? undefined,
        channel: row.channel ?? undefined,
        status: row.status,
        messageId: row.messageId ?? undefined,
        hostProofRef,
        errorClass: row.errorClass ?? undefined,
        fallbackRef: row.fallbackRef ?? undefined,
        createdAt: row.createdAt,
    };
}
export async function listDeliveryAttemptsByDecisionId(state, decisionId) {
    const rows = await state.db.select().from(deliveryAttempts).where(eq(deliveryAttempts.decisionId, decisionId));
    return rows.map(rowToRecord);
}
