import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const provenanceEdges = sqliteTable("provenance_edges", {
  id: text("id").primaryKey(),
  fromId: text("from_id").notNull(),
  toId: text("to_id").notNull(),
  kind: text("kind").notNull(),
  createdAt: text("created_at").notNull(),
});

export type ProvenanceEdgeRecord = typeof provenanceEdges.$inferSelect;
export type NewProvenanceEdgeRecord = typeof provenanceEdges.$inferInsert;
