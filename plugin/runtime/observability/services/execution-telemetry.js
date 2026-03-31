import { eq, and, gte } from "drizzle-orm";
import { executionAttempts } from "../db/schema/index.js";
import { redactEvent } from "../redaction/manifest.js";
import { persistRedactionManifest } from "./redaction-store.js";
export class ExecutionTelemetry {
    db;
    constructor(db) {
        this.db = db;
    }
    async recordExecutionAttempt(attempt) {
        const { redacted, manifest } = redactEvent(attempt);
        await this.db.db.insert(executionAttempts).values({
            id: redacted.id,
            traceId: redacted.traceId,
            decisionId: redacted.decisionId,
            intentId: redacted.intentId,
            platformId: redacted.platformId,
            capability: redacted.capability,
            channel: redacted.channel,
            status: redacted.status,
            commitState: redacted.commitState ?? null,
            failureClass: redacted.failureClass ?? null,
            retryPolicy: redacted.retryPolicy ?? null,
            idempotencyKey: redacted.idempotencyKey ?? null,
            startedAt: redacted.startedAt ?? null,
            finishedAt: redacted.finishedAt ?? null,
        });
        await persistRedactionManifest(this.db, redacted.id, "connector.attempt.recorded", manifest);
    }
    async startAttempt(input) {
        const id = `attempt-${input.traceId}-${Date.now()}`;
        const now = new Date().toISOString();
        const attempt = {
            id,
            traceId: input.traceId,
            decisionId: input.decisionId,
            intentId: input.intentId,
            platformId: input.platformId,
            capability: input.capability,
            channel: input.channel,
            status: "started",
            commitState: input.commitState,
            failureClass: input.failureClass,
            retryPolicy: input.retryPolicy,
            idempotencyKey: input.idempotencyKey,
            metadata: input.metadata,
            startedAt: now,
            finishedAt: undefined,
        };
        await this.recordExecutionAttempt(attempt);
        return id;
    }
    async completeAttempt(traceId, status, commitState, failureClass) {
        const now = new Date().toISOString();
        await this.db.db
            .update(executionAttempts)
            .set({
            status,
            commitState: commitState ?? null,
            failureClass: failureClass ?? null,
            finishedAt: now,
        })
            .where(eq(executionAttempts.traceId, traceId));
    }
    async updateCommitState(traceId, commitState) {
        await this.db.db
            .update(executionAttempts)
            .set({ commitState })
            .where(eq(executionAttempts.traceId, traceId));
    }
    async queryByTraceId(traceId) {
        const results = await this.db.db
            .select()
            .from(executionAttempts)
            .where(eq(executionAttempts.traceId, traceId))
            .limit(1);
        return results[0] ? this.mapToExecutionAttempt(results[0]) : null;
    }
    async queryByDecisionId(decisionId) {
        const results = await this.db.db
            .select()
            .from(executionAttempts)
            .where(eq(executionAttempts.decisionId, decisionId));
        return results.map(this.mapToExecutionAttempt);
    }
    async queryByPlatform(platformId) {
        const results = await this.db.db
            .select()
            .from(executionAttempts)
            .where(eq(executionAttempts.platformId, platformId));
        return results.map(this.mapToExecutionAttempt);
    }
    async queryFailedAttempts(since) {
        const results = await this.db.db
            .select()
            .from(executionAttempts)
            .where(and(eq(executionAttempts.status, "failed"), gte(executionAttempts.startedAt, since)));
        return results.map(this.mapToExecutionAttempt);
    }
    async queryByCommitState(commitState) {
        const results = await this.db.db
            .select()
            .from(executionAttempts)
            .where(eq(executionAttempts.commitState, commitState));
        return results.map(this.mapToExecutionAttempt);
    }
    mapToExecutionAttempt(row) {
        return {
            id: row.id,
            traceId: row.traceId,
            decisionId: row.decisionId,
            intentId: row.intentId,
            platformId: row.platformId,
            capability: row.capability,
            channel: row.channel,
            status: row.status,
            commitState: row.commitState,
            failureClass: row.failureClass ?? undefined,
            retryPolicy: row.retryPolicy ?? undefined,
            idempotencyKey: row.idempotencyKey ?? undefined,
            metadata: undefined,
            startedAt: row.startedAt ?? undefined,
            finishedAt: row.finishedAt ?? undefined,
        };
    }
}
