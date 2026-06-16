/**
 * LoopStageEventSink — v8 observability stage event recorder.
 *
 * Core logic: Validate, redact, and append LoopStageEvent rows.
 * Malformed events produce degraded diagnostics without blocking the
 * heartbeat main loop.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/observability-health-system.md §5`
 * - `.anws/v8/04_SYSTEM_DESIGN/observability-health-system.detail.md §3.1`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (writeLoopStageEvent)
 * - `src/shared/types/v8-contracts.js` (LoopStageEvent, SourceRef, V8ReasonCode)
 *
 * Boundary:
 * - Does NOT make semantic decisions about stage health.
 * - Does NOT block callers on DB failure; returns degraded result.
 * - Redacts credential-shaped values before persistence.
 *
 * Test coverage: tests/unit/observability/loop-stage-event-sink.test.ts
 */

import type { StateDatabase } from "../storage/db/index.js";
import { writeLoopStageEvent } from "../storage/v8-state-stores.js";
import type {
  LoopStageEvent,
  SourceRef,
  DegradedOperationResult,
  RedactionClass,
} from "../shared/types/v8-contracts.js";

// ───────────────────────────────────────────────────────────────
// Validation
// ───────────────────────────────────────────────────────────────

export interface RecordLoopStageEventOptions {
  now?: string;
}

export type RecordLoopStageEventResult =
  | { ok: true; id: string }
  | { ok: false; degraded: DegradedOperationResult };

function validateEvent(
  event: Partial<LoopStageEvent>,
): { ok: true } | { ok: false; reason: string; field: string } {
  if (!event.cycleId || event.cycleId.trim().length === 0) {
    return { ok: false, reason: "cycle_id_required", field: "cycleId" };
  }
  if (!event.stage || event.stage.trim().length === 0) {
    return { ok: false, reason: "stage_required", field: "stage" };
  }
  if (!event.status || event.status.trim().length === 0) {
    return { ok: false, reason: "status_required", field: "status" };
  }
  if (!event.occurredAt || event.occurredAt.trim().length === 0) {
    return { ok: false, reason: "occurred_at_required", field: "occurredAt" };
  }
  const validStages = [
    "ingestion",
    "perception",
    "judgment",
    "policy",
    "execution",
    "closure",
    "quiet",
    "dream",
    "projection",
  ] as const;
  if (!validStages.includes(event.stage as (typeof validStages)[number])) {
    return { ok: false, reason: "stage_invalid", field: "stage" };
  }
  const validStatuses = [
    "started",
    "completed",
    "skipped",
    "blocked",
    "failed",
  ] as const;
  if (!validStatuses.includes(event.status as (typeof validStatuses)[number])) {
    return { ok: false, reason: "status_invalid", field: "status" };
  }
  return { ok: true };
}

// ───────────────────────────────────────────────────────────────
// Redaction
// ───────────────────────────────────────────────────────────────

function redactSourceRefs(refs: SourceRef[]): {
  redacted: SourceRef[];
  redactionClass: RedactionClass;
} {
  let hasRedacted = false;
  let hasBlocked = false;

  const redacted = refs.map((ref) => {
    if (ref.sensitivityClass === "sensitive") {
      hasBlocked = true;
      return {
        ...ref,
        redactionClass: "blocked" as const,
        resolveStatus: "redacted" as const,
        resolveFailureReason: "sensitivity_class_blocked",
      };
    }
    if (ref.sensitivityClass === "private_context") {
      hasRedacted = true;
      return {
        ...ref,
        redactionClass: "redacted" as const,
        resolveStatus: "redacted" as const,
      };
    }
    return ref;
  });

  const redactionClass: RedactionClass = hasBlocked
    ? "blocked"
    : hasRedacted
      ? "redacted"
      : "none";

  return { redacted, redactionClass };
}

// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────

export async function recordLoopStageEvent(
  db: StateDatabase,
  event: Partial<LoopStageEvent>,
  options?: RecordLoopStageEventOptions,
): Promise<RecordLoopStageEventResult> {
  const validation = validateEvent(event);
  if (!validation.ok) {
    const degraded: DegradedOperationResult = {
      status: "degraded",
      reason: "stage_event_missing",
      ownerStage: (event.stage as any) || "ingestion",
      sourceRefs: event.sourceRefs || [],
      operatorNextAction: `Fix missing ${validation.field} in stage event`,
      retryable: false,
    };
    return { ok: false, degraded };
  }

  const now = options?.now ?? new Date().toISOString();
  const sourceRefs = event.sourceRefs ?? [];
  const { redacted: redactedRefs, redactionClass } = redactSourceRefs(sourceRefs);

  const record = {
    id: event.id ?? `evt_${now.replace(/[:.]/g, "")}_${event.cycleId}_${event.stage}`,
    cycleId: event.cycleId!,
    cycleSequence: event.cycleSequence ?? 0,
    stage: event.stage!,
    status: event.status!,
    reason: event.reason,
    sourceRefs: redactedRefs,
    redactionClass,
    occurredAt: event.occurredAt!,
    expectedDownstreamByCycle: event.expectedDownstreamByCycle,
    payloadJson: event.payloadJson ?? null,
  };

  const result = await writeLoopStageEvent(db, record);

  if ("id" in result) {
    return { ok: true, id: result.id };
  }

  return { ok: false, degraded: result };
}

// ───────────────────────────────────────────────────────────────
// Batch recording
// ───────────────────────────────────────────────────────────────

export interface BatchRecordResult {
  succeeded: string[];
  failed: { id?: string; degraded: DegradedOperationResult }[];
}

export async function recordLoopStageEvents(
  db: StateDatabase,
  events: Partial<LoopStageEvent>[],
  options?: RecordLoopStageEventOptions,
): Promise<BatchRecordResult> {
  const succeeded: string[] = [];
  const failed: BatchRecordResult["failed"] = [];

  for (const event of events) {
    const result = await recordLoopStageEvent(db, event, options);
    if (result.ok) {
      succeeded.push(result.id);
    } else {
      failed.push({ id: event.id ?? "unknown", degraded: result.degraded });
    }
  }

  return { succeeded, failed };
}
