import { real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const proposalRecords = sqliteTable("proposal_records", {
  id: text("id").primaryKey(),
  targetAssetId: text("target_asset_id").notNull(),
  beforeHash: text("before_hash"),
  afterHash: text("after_hash"),
  status: text("status").notNull(),
  proposedDiff: text("proposed_diff").notNull(),
  reason: text("reason").notNull(),
  supportingSources: text("supporting_sources").notNull(),
  confidence: real("confidence").notNull(),
  createdAt: text("created_at").notNull(),
  appliedAt: text("applied_at"),
});

export type ProposalRecord = typeof proposalRecords.$inferSelect;
export type NewProposalRecord = typeof proposalRecords.$inferInsert;
