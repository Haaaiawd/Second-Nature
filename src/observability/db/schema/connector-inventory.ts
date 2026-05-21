import { index, sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const connectorInventoryAudit = sqliteTable(
  "connector_inventory_audit",
  {
    auditId: text("audit_id").primaryKey(),
    snapshotId: text("snapshot_id").notNull(),
    scanned: integer("scanned").notNull(),
    registered: integer("registered").notNull(),
    skipped: integer("skipped").notNull(),
    conflictsJson: text("conflicts_json").notNull(),
    validationErrorsJson: text("validation_errors_json").notNull(),
    trustSummaryJson: text("trust_summary_json").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("connector_inventory_snapshot_idx").on(table.snapshotId),
    index("connector_inventory_created_at_idx").on(table.createdAt),
  ],
);

export type ConnectorInventoryAuditRow = typeof connectorInventoryAudit.$inferSelect;
export type NewConnectorInventoryAuditRow = typeof connectorInventoryAudit.$inferInsert;
