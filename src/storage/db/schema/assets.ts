import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const assetRegistry = sqliteTable(
  "asset_registry",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    path: text("path").notNull(),
    hash: text("hash").notNull(),
    version: integer("version").notNull().default(1),
    layer: text("layer").notNull(),
    lastIndexedAt: text("last_indexed_at").notNull(),
  },
  (table) => [uniqueIndex("asset_registry_path_idx").on(table.path)],
);

export type AssetRegistryRecord = typeof assetRegistry.$inferSelect;
export type NewAssetRegistryRecord = typeof assetRegistry.$inferInsert;
