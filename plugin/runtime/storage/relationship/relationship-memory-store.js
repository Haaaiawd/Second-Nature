import { eq } from "drizzle-orm";
import { relationshipMemory } from "../db/schema/relationship-memory.js";
function safeParseJson(json, fallback) {
    try {
        return JSON.parse(json);
    }
    catch {
        return fallback;
    }
}
function rowToMemory(row) {
    return {
        relationshipId: row.relationshipId,
        revision: row.revision,
        tonePreference: row.tonePreference,
        averageReplyDelayMinutes: row.averageReplyDelayMinutes ?? undefined,
        noReplyCount: row.noReplyCount,
        topicAffinities: safeParseJson(row.topicAffinitiesJson, []),
        lastInteractionAt: row.lastInteractionAt ?? undefined,
        sourceRefs: safeParseJson(row.sourceRefsJson, []),
        updatedAt: row.updatedAt,
    };
}
const DEFAULT_RELATIONSHIP_ID = "default";
export function createRelationshipMemoryStore(database) {
    const db = database.db;
    return {
        async upsertRelationshipMemory(input) {
            const existing = await db
                .select()
                .from(relationshipMemory)
                .where(eq(relationshipMemory.relationshipId, input.relationshipId))
                .limit(1);
            if (existing.length > 0) {
                await db
                    .update(relationshipMemory)
                    .set({
                    revision: input.revision,
                    tonePreference: input.tonePreference,
                    averageReplyDelayMinutes: input.averageReplyDelayMinutes ?? null,
                    noReplyCount: input.noReplyCount,
                    topicAffinitiesJson: JSON.stringify(input.topicAffinities),
                    lastInteractionAt: input.lastInteractionAt ?? null,
                    sourceRefsJson: JSON.stringify(input.sourceRefs),
                    updatedAt: input.updatedAt,
                })
                    .where(eq(relationshipMemory.relationshipId, input.relationshipId));
            }
            else {
                await db.insert(relationshipMemory).values({
                    relationshipId: input.relationshipId,
                    revision: input.revision,
                    tonePreference: input.tonePreference,
                    averageReplyDelayMinutes: input.averageReplyDelayMinutes ?? null,
                    noReplyCount: input.noReplyCount,
                    topicAffinitiesJson: JSON.stringify(input.topicAffinities),
                    lastInteractionAt: input.lastInteractionAt ?? null,
                    sourceRefsJson: JSON.stringify(input.sourceRefs),
                    updatedAt: input.updatedAt,
                });
            }
            return { relationshipId: input.relationshipId, status: "acknowledged" };
        },
        async loadRelationshipMemory(relationshipId) {
            const id = relationshipId ?? DEFAULT_RELATIONSHIP_ID;
            const rows = await db
                .select()
                .from(relationshipMemory)
                .where(eq(relationshipMemory.relationshipId, id))
                .limit(1);
            if (rows.length === 0)
                return null;
            return rowToMemory(rows[0]);
        },
    };
}
