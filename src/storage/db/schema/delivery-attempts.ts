import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const deliveryAttempts = sqliteTable(
  "delivery_attempts",
  {
    attemptId: text("attempt_id").primaryKey(),
    decisionId: text("decision_id").notNull(),
    target: text("target"),
    channel: text("channel"),
    status: text("status").notNull(),
    messageId: text("message_id"),
    hostProofRefJson: text("host_proof_ref_json"),
    errorClass: text("error_class"),
    fallbackRef: text("fallback_ref"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("delivery_attempt_decision_idx").on(table.decisionId)],
);

export type DeliveryAttemptRow = typeof deliveryAttempts.$inferSelect;
export type NewDeliveryAttemptRow = typeof deliveryAttempts.$inferInsert;
