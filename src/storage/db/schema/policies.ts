import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const policyRecords = sqliteTable("policy_records", {
  platformId: text("platform_id").primaryKey(),
  socialDailyLimit: integer("social_daily_limit").notNull(),
  quietEnabled: integer("quiet_enabled", { mode: "boolean" }).notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type PolicyRecord = typeof policyRecords.$inferSelect;
export type NewPolicyRecord = typeof policyRecords.$inferInsert;
