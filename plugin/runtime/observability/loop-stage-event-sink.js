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
import { writeLoopStageEvent } from "../storage/v8-state-stores.js";
function validateEvent(event) {
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
    ];
    if (!validStages.includes(event.stage)) {
        return { ok: false, reason: "stage_invalid", field: "stage" };
    }
    const validStatuses = [
        "started",
        "completed",
        "skipped",
        "blocked",
        "failed",
    ];
    if (!validStatuses.includes(event.status)) {
        return { ok: false, reason: "status_invalid", field: "status" };
    }
    return { ok: true };
}
// ───────────────────────────────────────────────────────────────
// Redaction
// ───────────────────────────────────────────────────────────────
function redactSourceRefs(refs) {
    let hasRedacted = false;
    let hasBlocked = false;
    const redacted = refs.map((ref) => {
        if (ref.sensitivityClass === "sensitive") {
            hasBlocked = true;
            return {
                ...ref,
                redactionClass: "blocked",
                resolveStatus: "redacted",
                resolveFailureReason: "sensitivity_class_blocked",
            };
        }
        if (ref.sensitivityClass === "private_context") {
            hasRedacted = true;
            return {
                ...ref,
                redactionClass: "redacted",
                resolveStatus: "redacted",
            };
        }
        return ref;
    });
    const redactionClass = hasBlocked
        ? "blocked"
        : hasRedacted
            ? "redacted"
            : "none";
    return { redacted, redactionClass };
}
// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────
export async function recordLoopStageEvent(db, event, options) {
    const validation = validateEvent(event);
    if (!validation.ok) {
        const degraded = {
            status: "degraded",
            reason: "stage_event_missing",
            ownerStage: event.stage || "ingestion",
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
        cycleId: event.cycleId,
        cycleSequence: event.cycleSequence ?? 0,
        stage: event.stage,
        status: event.status,
        reason: event.reason,
        sourceRefs: redactedRefs,
        redactionClass,
        occurredAt: event.occurredAt,
        expectedDownstreamByCycle: event.expectedDownstreamByCycle,
        payloadJson: event.payloadJson ?? null,
    };
    const result = await writeLoopStageEvent(db, record);
    if ("id" in result) {
        return { ok: true, id: result.id };
    }
    return { ok: false, degraded: result };
}
export async function recordLoopStageEvents(db, events, options) {
    const succeeded = [];
    const failed = [];
    for (const event of events) {
        const result = await recordLoopStageEvent(db, event, options);
        if (result.ok) {
            succeeded.push(result.id);
        }
        else {
            failed.push({ id: event.id ?? "unknown", degraded: result.degraded });
        }
    }
    return { succeeded, failed };
}
