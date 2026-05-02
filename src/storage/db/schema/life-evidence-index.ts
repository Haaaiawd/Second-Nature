import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const lifeEvidenceIndex = sqliteTable("life_evidence_index", {
  id: text("id").primaryKey(),
  timestamp: text("timestamp").notNull(),
  evidenceType: text("evidence_type").notNull(),
  sensitivity: text("sensitivity").notNull(),
  producer: text("producer").notNull(),
  artifactPath: text("artifact_path").notNull(),
  platformId: text("platform_id"),
  sourceRefsJson: text("source_refs_json").notNull(),
});

export type LifeEvidenceIndexRecord = typeof lifeEvidenceIndex.$inferSelect;
export type NewLifeEvidenceIndexRecord = typeof lifeEvidenceIndex.$inferInsert;
