import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const operatorFallbackArtifacts = sqliteTable("operator_fallback_artifacts", {
    fallbackRef: text("fallback_ref").primaryKey(),
    decisionId: text("decision_id").notNull(),
    status: text("status").notNull(),
    reason: text("reason").notNull(),
    sourceRefsJson: text("source_refs_json").notNull(),
    candidateMessage: text("candidate_message"),
    nextStep: text("next_step").notNull(),
    createdAt: text("created_at").notNull(),
}, (table) => [index("operator_fallback_decision_idx").on(table.decisionId)]);
