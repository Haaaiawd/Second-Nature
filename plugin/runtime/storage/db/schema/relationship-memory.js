import { index, sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const relationshipMemory = sqliteTable("relationship_memory", {
    relationshipId: text("relationship_id").primaryKey(),
    revision: integer("revision").notNull().default(1),
    tonePreference: text("tone_preference").notNull(),
    averageReplyDelayMinutes: integer("average_reply_delay_minutes"),
    noReplyCount: integer("no_reply_count").notNull().default(0),
    topicAffinitiesJson: text("topic_affinities_json").notNull(),
    lastInteractionAt: text("last_interaction_at"),
    sourceRefsJson: text("source_refs_json").notNull(),
    updatedAt: text("updated_at").notNull(),
}, (table) => [
    index("relationship_memory_updated_at_idx").on(table.updatedAt),
]);
