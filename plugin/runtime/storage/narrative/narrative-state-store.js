import { eq } from "drizzle-orm";
import { narrativeState } from "../db/schema/narrative-state.js";
function safeParseJson(json, fallback) {
    try {
        return JSON.parse(json);
    }
    catch {
        return fallback;
    }
}
function rowToState(row) {
    return {
        narrativeId: row.narrativeId,
        revision: row.revision,
        focus: row.focus,
        progress: safeParseJson(row.progressJson, []),
        nextIntent: row.nextIntent,
        confidence: row.confidence,
        sourceRefs: safeParseJson(row.sourceRefsJson, []),
        unsupportedClaims: safeParseJson(row.unsupportedClaimsJson, []),
        status: row.status,
        updatedAt: row.updatedAt,
    };
}
const DEFAULT_NARRATIVE_ID = "default";
export function createNarrativeStateStore(database) {
    const db = database.db;
    return {
        async updateNarrativeState(input) {
            const existing = await db
                .select()
                .from(narrativeState)
                .where(eq(narrativeState.narrativeId, input.narrativeId))
                .limit(1);
            if (existing.length > 0) {
                await db
                    .update(narrativeState)
                    .set({
                    revision: input.revision,
                    focus: input.focus,
                    progressJson: JSON.stringify(input.progress),
                    nextIntent: input.nextIntent,
                    confidence: input.confidence,
                    sourceRefsJson: JSON.stringify(input.sourceRefs),
                    unsupportedClaimsJson: JSON.stringify(input.unsupportedClaims),
                    status: input.status,
                    updatedAt: input.updatedAt,
                })
                    .where(eq(narrativeState.narrativeId, input.narrativeId));
            }
            else {
                await db.insert(narrativeState).values({
                    narrativeId: input.narrativeId,
                    revision: input.revision,
                    focus: input.focus,
                    progressJson: JSON.stringify(input.progress),
                    nextIntent: input.nextIntent,
                    confidence: input.confidence,
                    sourceRefsJson: JSON.stringify(input.sourceRefs),
                    unsupportedClaimsJson: JSON.stringify(input.unsupportedClaims),
                    status: input.status,
                    updatedAt: input.updatedAt,
                });
            }
            return { narrativeId: input.narrativeId, status: "acknowledged" };
        },
        async loadNarrativeState(narrativeId) {
            const id = narrativeId ?? DEFAULT_NARRATIVE_ID;
            const rows = await db
                .select()
                .from(narrativeState)
                .where(eq(narrativeState.narrativeId, id))
                .limit(1);
            if (rows.length === 0)
                return null;
            return rowToState(rows[0]);
        },
    };
}
