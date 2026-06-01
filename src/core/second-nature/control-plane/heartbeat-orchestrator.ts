/**
 * HeartbeatOrchestrator — v8 control-plane heartbeat cycle trace writer.
 *
 * Core logic: Emit ordered HeartbeatCycleTrace, invoke perception/judgment
 * ports, and return cycle result without making semantic action decisions.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/control-plane-system.md`
 * - `.anws/v8/04_SYSTEM_DESIGN/shared-v8-contracts.md §3`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (writeHeartbeatCycleTrace, readHeartbeatCycleTraces)
 * - `src/observability/loop-stage-event-sink.js` (recordLoopStageEvent)
 * - `src/core/second-nature/perception/perception-builder.js` (buildPerceptionCards)
 * - `src/core/second-nature/perception/judgment-engine.js` (runAgentJudgments)
 *
 * Boundary:
 * - Does NOT make semantic decisions about action allowability.
 * - Does NOT bypass ActionPolicyDecision.
 * - Degrades gracefully on DB failure or downstream unavailable.
 *
 * Test coverage: tests/unit/control-plane/heartbeat-cycle-trace.test.ts
 */

import type { StateDatabase } from "../../../storage/db/index.js";
import {
  writeHeartbeatCycleTrace,
  readHeartbeatCycleTraces,
} from "../../../storage/v8-state-stores.js";
import { recordLoopStageEvent } from "../../../observability/loop-stage-event-sink.js";
import { buildPerceptionCards } from "../perception/perception-builder.js";
import { runAgentJudgments } from "../perception/judgment-engine.js";
import type {
  SourceRef,
  DegradedOperationResult,
  V8ReasonCode,
} from "../../../shared/types/v8-contracts.js";

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

export interface HeartbeatOrchestrationRequest {
  workspaceRoot: string;
  requestedAt?: string;
  trigger?: "scheduled" | "manual" | "host";
}

export interface HeartbeatOrchestrationResult {
  cycleId: string;
  cycleSequence: number;
  closureRef?: SourceRef;
  noActionReason?: V8ReasonCode;
  degraded?: DegradedOperationResult;
}

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

async function nextCycleSequence(db: StateDatabase): Promise<number> {
  const result = await readHeartbeatCycleTraces(db, 1);
  if (result.degraded || result.rows.length === 0) {
    return 1;
  }
  return (result.rows[0]?.cycleSequence ?? 0) + 1;
}

function buildCycleId(sequence: number, now: string): string {
  return `cyc_${now.replace(/[:.]/g, "")}_${sequence}`;
}

// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────

export async function runHeartbeatCycle(
  db: StateDatabase,
  request: HeartbeatOrchestrationRequest,
): Promise<HeartbeatOrchestrationResult | DegradedOperationResult> {
  const now = request.requestedAt ?? new Date().toISOString();
  const cycleSequence = await nextCycleSequence(db);
  const cycleId = buildCycleId(cycleSequence, now);

  // Write cycle trace — started
  const traceResult = await writeHeartbeatCycleTrace(db, {
    id: cycleId,
    cycleSequence,
    heartbeatStartedAt: now,
    inputCount: 0,
    outputCount: 0,
    status: "started",
    sourceRefs: [
      {
        uri: `sn://heartbeat/${cycleId}`,
        family: "audit",
        id: cycleId,
        redactionClass: "none",
        resolveStatus: "resolvable",
      },
    ],
  });

  if ("reason" in traceResult) {
    return {
      status: "degraded",
      reason: "state_unreadable",
      ownerStage: "ingestion",
      sourceRefs: [],
      operatorNextAction: "Retry heartbeat after DB recovery",
      retryable: true,
    };
  }

  // Record ingestion stage started
  await recordLoopStageEvent(db, {
    id: `evt_${cycleId}_ingestion`,
    cycleId,
    cycleSequence,
    stage: "ingestion",
    status: "started",
    occurredAt: now,
    sourceRefs: [],
  });

  // ── Perception stage ──
  const perceptionResult = await buildPerceptionCards(db, { cycleId, now });

  const perceptionDegraded = "status" in perceptionResult && perceptionResult.status === "degraded"
    ? perceptionResult
    : null;

  await recordLoopStageEvent(db, {
    id: `evt_${cycleId}_perception`,
    cycleId,
    cycleSequence,
    stage: "perception",
    status: perceptionDegraded ? "failed" : "completed",
    occurredAt: new Date().toISOString(),
    reason: perceptionDegraded
      ? (perceptionResult as any).reason
      : undefined,
    sourceRefs: [],
  });

  if (perceptionDegraded || !("cards" in perceptionResult)) {
    return {
      cycleId,
      cycleSequence,
      degraded: perceptionDegraded
        ? {
            status: "degraded",
            reason: (perceptionResult as any).reason ?? "state_unreadable",
            ownerStage: "perception",
            sourceRefs: [],
            operatorNextAction: "Retry heartbeat after perception recovery",
            retryable: true,
          }
        : undefined,
    };
  }

  const cards = perceptionResult.cards;
  if (cards.length === 0) {
    // No cards → no judgment needed
    await recordLoopStageEvent(db, {
      id: `evt_${cycleId}_judgment`,
      cycleId,
      cycleSequence,
      stage: "judgment",
      status: "skipped",
      occurredAt: new Date().toISOString(),
      reason: "evidence_batch_empty",
      sourceRefs: [],
    });

    return {
      cycleId,
      cycleSequence,
      noActionReason: "evidence_batch_empty",
    };
  }

  // ── Judgment stage ──
  const judgmentResult = await runAgentJudgments(
    db,
    cards.map((c) => c.id),
    { now },
  );

  const judgmentFailed = judgmentResult.failed.length > 0;

  await recordLoopStageEvent(db, {
    id: `evt_${cycleId}_judgment`,
    cycleId,
    cycleSequence,
    stage: "judgment",
    status: judgmentFailed ? "failed" : "completed",
    occurredAt: new Date().toISOString(),
    sourceRefs: [],
  });

  // Return cycle result
  return {
    cycleId,
    cycleSequence,
    closureRef: judgmentResult.succeeded.length > 0
      ? {
          uri: `sn://judgment/${cycleId}`,
          family: "judgment",
          id: cycleId,
          redactionClass: "none",
          resolveStatus: "resolvable",
        }
      : undefined,
    noActionReason: judgmentResult.succeeded.length === 0 ? "proposal_no_action" : undefined,
  };
}
