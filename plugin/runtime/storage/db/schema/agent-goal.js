import { index, sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const agentGoal = sqliteTable("agent_goal", {
    goalId: text("goal_id").primaryKey(),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    origin: text("origin").notNull(),
    description: text("description").notNull(),
    completionCriteria: text("completion_criteria").notNull(),
    risk: text("risk").notNull(),
    priorityHint: integer("priority_hint").notNull().default(0),
    sourceRefsJson: text("source_refs_json").notNull(),
    acceptedBy: text("accepted_by"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
}, (table) => [
    index("agent_goal_status_idx").on(table.status),
    index("agent_goal_origin_idx").on(table.origin),
    index("agent_goal_updated_at_idx").on(table.updatedAt),
]);
