import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const policyRecords = sqliteTable("policy_records", {
    platformId: text("platform_id").primaryKey(),
    socialDailyLimit: integer("social_daily_limit").notNull(),
    quietEnabled: integer("quiet_enabled", { mode: "boolean" }).notNull(),
    outreachDailyBudget: integer("outreach_daily_budget").notNull().default(2),
    updatedAt: text("updated_at").notNull(),
});
