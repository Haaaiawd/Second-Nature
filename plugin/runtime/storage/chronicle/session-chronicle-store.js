import { eq, gte, lte, inArray, desc, and } from "drizzle-orm";
import { sessionChronicle } from "../db/schema/session-chronicle.js";
function rowToEntry(row) {
    return {
        entryId: row.entryId,
        eventKind: row.eventKind,
        actor: row.actor,
        occurredAt: row.occurredAt,
        summary: row.summary,
        result: row.result,
        sourceRefs: safeParseJson(row.sourceRefsJson, []),
        relatedDecisionId: row.relatedDecisionId ?? undefined,
        relatedDreamRunId: row.relatedDreamRunId ?? undefined,
        ownerReply: row.ownerReplyJson ? safeParseJson(row.ownerReplyJson, undefined) : undefined,
    };
}
function safeParseJson(json, fallback) {
    try {
        return JSON.parse(json);
    }
    catch {
        return fallback;
    }
}
export function createSessionChronicleStore(database) {
    const db = database.db;
    return {
        async appendSessionChronicle(entry) {
            await db.insert(sessionChronicle).values({
                entryId: entry.entryId,
                eventKind: entry.eventKind,
                actor: entry.actor,
                occurredAt: entry.occurredAt,
                summary: entry.summary,
                result: entry.result,
                sourceRefsJson: JSON.stringify(entry.sourceRefs),
                relatedDecisionId: entry.relatedDecisionId ?? null,
                relatedDreamRunId: entry.relatedDreamRunId ?? null,
                ownerReplyJson: entry.ownerReply ? JSON.stringify(entry.ownerReply) : null,
            });
            return { entryId: entry.entryId, status: "acknowledged" };
        },
        async loadSessionChronicle(query) {
            const conditions = [];
            if (query.eventKinds && query.eventKinds.length > 0) {
                conditions.push(inArray(sessionChronicle.eventKind, query.eventKinds));
            }
            if (query.from) {
                conditions.push(gte(sessionChronicle.occurredAt, query.from));
            }
            if (query.to) {
                conditions.push(lte(sessionChronicle.occurredAt, query.to));
            }
            if (query.actor) {
                conditions.push(eq(sessionChronicle.actor, query.actor));
            }
            const rows = await db
                .select()
                .from(sessionChronicle)
                .where(conditions.length > 0 ? and(...conditions) : undefined)
                .orderBy(desc(sessionChronicle.occurredAt))
                .limit(query.limit ?? 100);
            return rows.map(rowToEntry);
        },
    };
}
