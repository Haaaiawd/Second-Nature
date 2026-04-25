import { sqliteTable, text } from "drizzle-orm/sqlite-core";
export const intentCommitRecords = sqliteTable("intent_commit_records", {
    id: text("id").primaryKey(),
    intentId: text("intent_id").notNull(),
    decisionId: text("decision_id").notNull(),
    checkpointId: text("checkpoint_id"),
    state: text("state").notNull(),
    outcomeRef: text("outcome_ref"),
    metadataJson: text("metadata_json"),
    updatedAt: text("updated_at").notNull(),
});
