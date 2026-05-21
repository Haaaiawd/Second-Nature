import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const memoryStore = sqliteTable(
  "memory_store",
  {
    memoryStoreId: text("memory_store_id").primaryKey(),
    lifecycleStatus: text("lifecycle_status").notNull(),
    createdAt: text("created_at").notNull(),
    inputMemoryStoreId: text("input_memory_store_id"),
    dreamRunId: text("dream_run_id"),
    canonicalEntriesJson: text("canonical_entries_json").notNull(),
    insightsJson: text("insights_json").notNull(),
    narrativeSnapshotJson: text("narrative_snapshot_json"),
    relationshipSnapshotJson: text("relationship_snapshot_json"),
    validationJson: text("validation_json").notNull(),
  },
  (table) => [
    index("memory_store_lifecycle_idx").on(table.lifecycleStatus),
    index("memory_store_created_at_idx").on(table.createdAt),
    index("memory_store_input_idx").on(table.inputMemoryStoreId),
    index("memory_store_dream_run_idx").on(table.dreamRunId),
  ],
);

export type MemoryStoreRow = typeof memoryStore.$inferSelect;
export type NewMemoryStoreRow = typeof memoryStore.$inferInsert;
