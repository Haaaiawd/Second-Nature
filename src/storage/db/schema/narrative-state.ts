import { index, sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const narrativeState = sqliteTable(
  "narrative_state",
  {
    narrativeId: text("narrative_id").primaryKey(),
    revision: integer("revision").notNull().default(1),
    focus: text("focus").notNull(),
    progressJson: text("progress_json").notNull(),
    nextIntent: text("next_intent").notNull(),
    confidence: integer("confidence").notNull().default(0),
    sourceRefsJson: text("source_refs_json").notNull(),
    unsupportedClaimsJson: text("unsupported_claims_json").notNull(),
    status: text("status").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("narrative_state_status_idx").on(table.status),
    index("narrative_state_updated_at_idx").on(table.updatedAt),
  ],
);

export type NarrativeStateRow = typeof narrativeState.$inferSelect;
export type NewNarrativeStateRow = typeof narrativeState.$inferInsert;
