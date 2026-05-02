import { sqliteTable, text } from "drizzle-orm/sqlite-core";
export const hostCapabilityReports = sqliteTable("host_capability_reports", {
    reportId: text("report_id").primaryKey(),
    generatedAt: text("generated_at").notNull(),
    hostVersion: text("host_version"),
    observedVersion: text("observed_version"),
    docCheckedAt: text("doc_checked_at").notNull(),
    docLinksJson: text("doc_links_json").notNull(),
    deliveryTarget: text("delivery_target").notNull(),
    conflictRecordsJson: text("conflict_records_json").notNull(),
    fullReportJson: text("full_report_json").notNull(),
});
