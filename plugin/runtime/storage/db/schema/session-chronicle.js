import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const sessionChronicle = sqliteTable("session_chronicle", {
    entryId: text("entry_id").primaryKey(),
    eventKind: text("event_kind").notNull(),
    actor: text("actor").notNull(),
    occurredAt: text("occurred_at").notNull(),
    summary: text("summary").notNull(),
    result: text("result").notNull(),
    sourceRefsJson: text("source_refs_json").notNull(),
    relatedDecisionId: text("related_decision_id"),
    relatedDreamRunId: text("related_dream_run_id"),
    ownerReplyJson: text("owner_reply_json"),
}, (table) => [
    index("session_chronicle_event_kind_idx").on(table.eventKind),
    index("session_chronicle_occurred_at_idx").on(table.occurredAt),
    index("session_chronicle_actor_idx").on(table.actor),
    index("session_chronicle_decision_idx").on(table.relatedDecisionId),
]);
