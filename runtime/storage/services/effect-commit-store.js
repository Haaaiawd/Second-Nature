import * as crypto from "crypto";
import { eq } from "drizzle-orm";
import { intentCommitRecords } from "../db/schema/index.js";
const VALID_TRANSITIONS = {
    planned: ["dispatched", "aborted"],
    dispatched: ["externally_acknowledged", "aborted"],
    externally_acknowledged: ["committed", "reconcile", "aborted"],
    committed: [],
    reconcile: ["planned", "aborted"],
    aborted: [],
};
export function createEffectCommitStore(db) {
    return {
        async createIntentCommitRecord(input) {
            const record = {
                id: crypto.randomUUID(),
                intentId: input.intentId,
                decisionId: input.decisionId,
                checkpointId: input.checkpointId ?? null,
                state: input.state,
                outcomeRef: null,
                metadataJson: null,
                updatedAt: new Date().toISOString(),
            };
            await db.insert(intentCommitRecords).values(record);
            return {
                id: record.id,
                intentId: record.intentId,
                decisionId: record.decisionId,
                checkpointId: record.checkpointId ?? undefined,
                state: record.state,
                outcomeRef: undefined,
                metadata: undefined,
                updatedAt: record.updatedAt,
            };
        },
        async advanceIntentCommitState(id, state, metadata) {
            const existing = await db.query.intentCommitRecords.findFirst({
                where: (tbl) => eq(tbl.id, id),
            });
            if (!existing)
                throw new Error("intent_commit_not_found");
            const currentState = existing.state;
            const allowed = VALID_TRANSITIONS[currentState] ?? [];
            if (!allowed.includes(state)) {
                throw new Error(`invalid_state_transition: ${currentState} -> ${state}`);
            }
            await db.update(intentCommitRecords).set({
                state,
                metadataJson: metadata ? JSON.stringify(metadata) : null,
                updatedAt: new Date().toISOString(),
            }).where(eq(intentCommitRecords.id, id));
        },
        async commitIntentOutcome(id, outcome) {
            await db.update(intentCommitRecords).set({
                state: "committed",
                outcomeRef: outcome.outcomeRef,
                metadataJson: JSON.stringify({ traceId: outcome.traceId }),
                updatedAt: new Date().toISOString(),
            }).where(eq(intentCommitRecords.id, id));
        },
        async loadIntentCommitRecord(intentId) {
            const record = await db.query.intentCommitRecords.findFirst({
                where: (tbl) => eq(tbl.intentId, intentId),
            });
            if (!record)
                return null;
            return {
                id: record.id,
                intentId: record.intentId,
                decisionId: record.decisionId,
                checkpointId: record.checkpointId ?? undefined,
                state: record.state,
                outcomeRef: record.outcomeRef ?? undefined,
                metadata: record.metadataJson ? JSON.parse(record.metadataJson) : undefined,
                updatedAt: record.updatedAt,
            };
        },
        async abortIntentCommit(id, _reason) {
            await db.update(intentCommitRecords).set({
                state: "aborted",
                updatedAt: new Date().toISOString(),
            }).where(eq(intentCommitRecords.id, id));
        },
        async markIntentCommitReconcile(id, details) {
            await db.update(intentCommitRecords).set({
                state: "reconcile",
                metadataJson: JSON.stringify(details),
                updatedAt: new Date().toISOString(),
            }).where(eq(intentCommitRecords.id, id));
        },
    };
}
