/**
 * Read models for delivery attempts by decisionId (T4.3.1).
 */
import { eq } from "drizzle-orm";
import type { StateDatabase } from "../db/index.js";
import { deliveryAttempts } from "../db/schema/delivery-attempts.js";
import type { DeliveryAttemptRecord } from "./types.js";
import type { LifeEvidenceSourceRef } from "../life-evidence/types.js";

function rowToRecord(row: typeof deliveryAttempts.$inferSelect): DeliveryAttemptRecord {
  let hostProofRef: LifeEvidenceSourceRef | undefined;
  if (row.hostProofRefJson) {
    try {
      hostProofRef = JSON.parse(row.hostProofRefJson) as LifeEvidenceSourceRef;
    } catch {
      hostProofRef = undefined;
    }
  }
  return {
    attemptId: row.attemptId,
    decisionId: row.decisionId,
    target: (row.target as DeliveryAttemptRecord["target"]) ?? undefined,
    channel: row.channel ?? undefined,
    status: row.status as DeliveryAttemptRecord["status"],
    messageId: row.messageId ?? undefined,
    hostProofRef,
    errorClass: row.errorClass ?? undefined,
    fallbackRef: row.fallbackRef ?? undefined,
    createdAt: row.createdAt,
  };
}

export async function listDeliveryAttemptsByDecisionId(
  state: StateDatabase,
  decisionId: string,
): Promise<DeliveryAttemptRecord[]> {
  const rows = await state.db.select().from(deliveryAttempts).where(eq(deliveryAttempts.decisionId, decisionId));
  return rows.map(rowToRecord);
}
