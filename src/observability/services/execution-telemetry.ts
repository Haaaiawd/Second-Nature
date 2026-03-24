import { eq, and, gte } from "drizzle-orm";
import type { ObservabilityDatabase } from "../db/index.js";
import { executionAttempts } from "../db/schema/index.js";
import type { ExecutionAttempt, IntentCommitState } from "../../shared/types/continuity.js";

export interface ExecutionAttemptInput {
  traceId: string;
  decisionId: string;
  intentId: string;
  platformId: string;
  capability: string;
  channel: string;
  status: ExecutionAttempt["status"];
  commitState?: IntentCommitState;
  failureClass?: string;
  retryPolicy?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  startedAt?: string;
  finishedAt?: string;
}

export class ExecutionTelemetry {
  constructor(private db: ObservabilityDatabase) {}

  async recordExecutionAttempt(attempt: ExecutionAttempt): Promise<void> {
    await this.db.db.insert(executionAttempts).values({
      id: attempt.id,
      traceId: attempt.traceId,
      decisionId: attempt.decisionId,
      intentId: attempt.intentId,
      platformId: attempt.platformId,
      capability: attempt.capability,
      channel: attempt.channel,
      status: attempt.status,
      commitState: attempt.commitState ?? null,
      failureClass: attempt.failureClass ?? null,
      retryPolicy: attempt.retryPolicy ?? null,
      idempotencyKey: attempt.idempotencyKey ?? null,
      startedAt: attempt.startedAt ?? null,
      finishedAt: attempt.finishedAt ?? null,
    });
  }

  async startAttempt(input: ExecutionAttemptInput): Promise<string> {
    const id = `attempt-${input.traceId}-${Date.now()}`;
    const now = new Date().toISOString();

    const attempt: ExecutionAttempt = {
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

  async completeAttempt(
    traceId: string,
    status: "succeeded" | "failed",
    commitState?: IntentCommitState,
    failureClass?: string
  ): Promise<void> {
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

  async updateCommitState(traceId: string, commitState: IntentCommitState): Promise<void> {
    await this.db.db
      .update(executionAttempts)
      .set({ commitState })
      .where(eq(executionAttempts.traceId, traceId));
  }

  async queryByTraceId(traceId: string): Promise<ExecutionAttempt | null> {
    const results = await this.db.db
      .select()
      .from(executionAttempts)
      .where(eq(executionAttempts.traceId, traceId))
      .limit(1);

    return results[0] ? this.mapToExecutionAttempt(results[0]) : null;
  }

  async queryByDecisionId(decisionId: string): Promise<ExecutionAttempt[]> {
    const results = await this.db.db
      .select()
      .from(executionAttempts)
      .where(eq(executionAttempts.decisionId, decisionId));

    return results.map(this.mapToExecutionAttempt);
  }

  async queryByPlatform(platformId: string): Promise<ExecutionAttempt[]> {
    const results = await this.db.db
      .select()
      .from(executionAttempts)
      .where(eq(executionAttempts.platformId, platformId));

    return results.map(this.mapToExecutionAttempt);
  }

  async queryFailedAttempts(since: string): Promise<ExecutionAttempt[]> {
    const results = await this.db.db
      .select()
      .from(executionAttempts)
      .where(
        and(
          eq(executionAttempts.status, "failed"),
          gte(executionAttempts.startedAt, since)
        )
      );

    return results.map(this.mapToExecutionAttempt);
  }

  async queryByCommitState(commitState: IntentCommitState): Promise<ExecutionAttempt[]> {
    const results = await this.db.db
      .select()
      .from(executionAttempts)
      .where(eq(executionAttempts.commitState, commitState));

    return results.map(this.mapToExecutionAttempt);
  }

  private mapToExecutionAttempt(row: typeof executionAttempts.$inferSelect): ExecutionAttempt {
    return {
      id: row.id,
      traceId: row.traceId,
      decisionId: row.decisionId,
      intentId: row.intentId,
      platformId: row.platformId,
      capability: row.capability,
      channel: row.channel,
      status: row.status as ExecutionAttempt["status"],
      commitState: row.commitState as IntentCommitState | undefined,
      failureClass: row.failureClass ?? undefined,
      retryPolicy: row.retryPolicy ?? undefined,
      idempotencyKey: row.idempotencyKey ?? undefined,
      metadata: undefined,
      startedAt: row.startedAt ?? undefined,
      finishedAt: row.finishedAt ?? undefined,
    };
  }
}
