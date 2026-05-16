import { eq, desc } from "drizzle-orm";
import { memoryStore } from "../db/schema/memory-store.js";
function safeParseJson(json, fallback) {
    try {
        return JSON.parse(json);
    }
    catch {
        return fallback;
    }
}
function rowToStore(row) {
    return {
        memoryStoreId: row.memoryStoreId,
        lifecycleStatus: row.lifecycleStatus,
        createdAt: row.createdAt,
        inputMemoryStoreId: row.inputMemoryStoreId ?? undefined,
        dreamRunId: row.dreamRunId ?? undefined,
        canonicalEntries: safeParseJson(row.canonicalEntriesJson, []),
        insights: safeParseJson(row.insightsJson, []),
        narrativeSnapshot: row.narrativeSnapshotJson ? safeParseJson(row.narrativeSnapshotJson, undefined) : undefined,
        relationshipSnapshot: row.relationshipSnapshotJson ? safeParseJson(row.relationshipSnapshotJson, undefined) : undefined,
        validation: safeParseJson(row.validationJson, { passed: false, summary: "", checkedAt: "" }),
    };
}
export function createMemoryStoreLifecycle(database) {
    const db = database.db;
    return {
        async writeMemoryStore(output) {
            const existing = await db
                .select()
                .from(memoryStore)
                .where(eq(memoryStore.memoryStoreId, output.memoryStoreId))
                .limit(1);
            if (existing.length > 0) {
                await db
                    .update(memoryStore)
                    .set({
                    lifecycleStatus: output.lifecycleStatus,
                    inputMemoryStoreId: output.inputMemoryStoreId ?? null,
                    dreamRunId: output.dreamRunId ?? null,
                    canonicalEntriesJson: JSON.stringify(output.canonicalEntries),
                    insightsJson: JSON.stringify(output.insights),
                    narrativeSnapshotJson: output.narrativeSnapshot ? JSON.stringify(output.narrativeSnapshot) : null,
                    relationshipSnapshotJson: output.relationshipSnapshot ? JSON.stringify(output.relationshipSnapshot) : null,
                    validationJson: JSON.stringify(output.validation),
                })
                    .where(eq(memoryStore.memoryStoreId, output.memoryStoreId));
            }
            else {
                await db.insert(memoryStore).values({
                    memoryStoreId: output.memoryStoreId,
                    lifecycleStatus: output.lifecycleStatus,
                    createdAt: output.createdAt,
                    inputMemoryStoreId: output.inputMemoryStoreId ?? null,
                    dreamRunId: output.dreamRunId ?? null,
                    canonicalEntriesJson: JSON.stringify(output.canonicalEntries),
                    insightsJson: JSON.stringify(output.insights),
                    narrativeSnapshotJson: output.narrativeSnapshot ? JSON.stringify(output.narrativeSnapshot) : null,
                    relationshipSnapshotJson: output.relationshipSnapshot ? JSON.stringify(output.relationshipSnapshot) : null,
                    validationJson: JSON.stringify(output.validation),
                });
            }
            return { memoryStoreId: output.memoryStoreId, status: "acknowledged" };
        },
        async loadMemoryStore(memoryStoreId) {
            const rows = await db
                .select()
                .from(memoryStore)
                .where(eq(memoryStore.memoryStoreId, memoryStoreId))
                .limit(1);
            if (rows.length === 0)
                return null;
            return rowToStore(rows[0]);
        },
        async transitionMemoryStoreLifecycle(input) {
            const existing = await db
                .select()
                .from(memoryStore)
                .where(eq(memoryStore.memoryStoreId, input.memoryStoreId))
                .limit(1);
            if (existing.length === 0) {
                return { memoryStoreId: input.memoryStoreId, status: "degraded" };
            }
            const updates = { lifecycleStatus: input.newStatus };
            if (input.validation) {
                updates.validationJson = JSON.stringify(input.validation);
            }
            await db
                .update(memoryStore)
                .set(updates)
                .where(eq(memoryStore.memoryStoreId, input.memoryStoreId));
            return { memoryStoreId: input.memoryStoreId, status: "acknowledged" };
        },
        async loadAcceptedMemoryProjection() {
            const rows = await db
                .select()
                .from(memoryStore)
                .where(eq(memoryStore.lifecycleStatus, "accepted"))
                .orderBy(desc(memoryStore.createdAt))
                .limit(1);
            if (rows.length === 0)
                return null;
            return rowToStore(rows[0]);
        },
        async listMemoryStoresByStatus(status) {
            const rows = await db
                .select()
                .from(memoryStore)
                .where(eq(memoryStore.lifecycleStatus, status));
            return rows.map(rowToStore);
        },
    };
}
