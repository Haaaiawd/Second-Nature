/**
 * v9 ActionClosureRecorder — Record v9 heartbeat cycle closure outcomes.
 *
 * Core logic: Write ActionClosureRecord rows with v9 source-ref shape,
 * routine/activity linkage, and exactly-one terminal closure invariant.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/action-closure-policy-system.detail.md §3.4-§3.6`
 * - `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md §9`
 * - ADR-002: Attention is not Agent mind
 * - ADR-005: Procedural memory as verified routine
 *
 * Dependencies:
 * - `src/storage/db/schema/v8-entities.js` (action_closure_record table)
 * - `src/shared/types/v9-contracts.js` (v9 SourceRef, ActionClosureRecord)
 *
 * Boundary:
 * - Does not execute actions; only records outcomes.
 * - Preserves v9 SourceRef shape in JSON columns.
 * - Enforces exactly one terminal closure per cycle via idempotency check.
 *
 * Test coverage: `tests/unit/action/v9-action-closure-recorder.test.ts`
 */

import { eq, desc } from "drizzle-orm";
import type { StateDatabase } from "../../../storage/db/index.js";
import {
  actionClosureRecord,
  type ActionClosureRecordSelect,
} from "../../../storage/db/schema/v8-entities.js";
import type {
  ActionClosureActionKind,
  ActionClosureDecision,
  SourceRef,
  V9ReasonCode,
  DegradedOperationResult,
  ActionClosureRecord,
} from "../../../shared/types/v9-contracts.js";
import { classifyDegradedStatus } from "../../../shared/degraded-status-classifier.js";

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

export interface V9ClosureRecordRequest {
  cycleId: string;
  cycleSequence: number;
  closureId: string;
  actionKind: ActionClosureActionKind;
  decision: ActionClosureDecision;
  reasonCode: V9ReasonCode;
  platformId?: string;
  capabilityId?: string;
  intentId?: string;
  sourceRefs: SourceRef[];
  proofRefs?: SourceRef[];
  traceRefs?: SourceRef[];
  closureRefs?: SourceRef[];
  payload?: Record<string, unknown>;
  activityThreadId?: string;
  activityStepId?: string;
  routineInvocationId?: string;
  routineVersion?: string;
  createdAt?: string;
}

export interface V9ClosureRecordResult {
  id: string;
  idempotent?: boolean;
}

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

function makeDegraded(
  reason: V9ReasonCode,
  sourceRefs: SourceRef[],
  detail?: string,
): DegradedOperationResult {
  return {
    status: classifyDegradedStatus(reason as unknown as import("../../../shared/types/v8-contracts.js").V8ReasonCode),
    reason: reason as unknown as import("../../../shared/types/v8-contracts.js").V8ReasonCode,
    ownerStage: "closure",
    sourceRefs: sourceRefs as unknown as import("../../../shared/types/v8-contracts.js").SourceRef[],
    operatorNextAction: detail ?? "Retry closure write after DB recovery",
    retryable: true,
  };
}

function serializeSourceRefs(refs: SourceRef[]): string {
  return JSON.stringify(refs);
}

function parseSourceRefs(json: string | null | undefined): SourceRef[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed as SourceRef[];
    return [];
  } catch {
    return [];
  }
}

function inferDecisionFromReason(reason: string): ActionClosureDecision {
  if (reason === "policy_allowed" || reason === "closure_completed") return "allow";
  if (reason === "policy_deferred_owner_confirmation") return "defer";
  if (reason === "policy_downgraded_to_draft") return "downgrade";
  return "deny";
}

function mapRowToV9Closure(row: ActionClosureRecordSelect): ActionClosureRecord {
  const payload = safeParsePayload(row.payloadJson);
  return {
    id: row.id,
    cycleSequence: typeof payload.cycleSequence === "number" ? payload.cycleSequence : 0,
    intentId: row.proposalId ?? undefined,
    actionKind: (row.status as ActionClosureActionKind) ?? "no_action",
    decision: inferDecisionFromReason(row.reason ?? ""),
    platformId: row.platformId ?? undefined,
    capabilityId: row.capabilityId ?? undefined,
    sourceRefs: parseSourceRefs(row.sourceRefsJson),
    proofRefs: parseSourceRefs(row.proofRefsJson),
    traceRefs: parseSourceRefs(row.traceRefsJson),
    closureRefs: [], // v8 table has no dedicated closureRefs column
    payloadJson: row.payloadJson ?? undefined,
    reasonCode: (row.reason ?? "closure_no_action") as V9ReasonCode,
    routineInvocationId: row.routineId ?? (payload.routineInvocationId as string | undefined),
    routineVersion: payload.routineVersion as string | undefined,
    activityThreadId: row.activityThreadId ?? undefined,
    activityStepId: row.activityStepId ?? undefined,
    createdAt: row.createdAt,
  };
}

function safeParsePayload(json: string | null | undefined): Record<string, unknown> {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    return {};
  } catch {
    return {};
  }
}

// ───────────────────────────────────────────────────────────────
// Public API — Read
// ───────────────────────────────────────────────────────────────

export async function readV9ActionClosuresByCycle(
  db: StateDatabase,
  cycleId: string,
): Promise<{ rows: ActionClosureRecord[]; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(actionClosureRecord)
      .where(eq(actionClosureRecord.cycleId, cycleId))
      .orderBy(desc(actionClosureRecord.createdAt));
    return { rows: rows.map(mapRowToV9Closure) };
  } catch (err) {
    return {
      rows: [],
      degraded: makeDegraded(
        "state_unreadable",
        [],
        `Failed to read closures for cycle ${cycleId}: ${err instanceof Error ? err.message : String(err)}`,
      ),
    };
  }
}

// ───────────────────────────────────────────────────────────────
// Public API — Write
// ───────────────────────────────────────────────────────────────

export async function recordV9ActionClosure(
  db: StateDatabase,
  request: V9ClosureRecordRequest,
): Promise<V9ClosureRecordResult | DegradedOperationResult> {
  const now = request.createdAt ?? new Date().toISOString();

  if (request.sourceRefs.length === 0) {
    return makeDegraded(
      "ledger_missing_source_refs",
      [],
      "v9 closure requires at least one source ref",
    );
  }

  // Exactly-one invariant: skip if any closure already exists for this cycle.
  const existing = await readV9ActionClosuresByCycle(db, request.cycleId);
  if (existing.degraded) {
    return existing.degraded;
  }
  if (existing.rows.length > 0) {
    return { id: existing.rows[0].id, idempotent: true };
  }

  const payload = {
    ...request.payload,
    cycleSequence: request.cycleSequence,
    routineVersion: request.routineVersion,
  };

  try {
    await db.db.insert(actionClosureRecord).values({
      id: request.closureId,
      createdAt: now,
      cycleId: request.cycleId,
      platformId: request.platformId,
      capabilityId: request.capabilityId,
      proposalId: request.intentId,
      status: request.actionKind,
      reason: request.reasonCode,
      nextState: "await_next_cycle",
      sourceRefsJson: serializeSourceRefs(request.sourceRefs),
      proofRefsJson: serializeSourceRefs(request.proofRefs ?? []),
      traceRefsJson: serializeSourceRefs(request.traceRefs ?? []),
      redactionClass: "none",
      payloadJson: JSON.stringify(payload),
      routineId: request.routineInvocationId,
      activityThreadId: request.activityThreadId,
      activityStepId: request.activityStepId,
    });
    return { id: request.closureId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("UNIQUE constraint failed") && message.includes("cycle_id")) {
      // Race loser: another writer inserted a closure for this cycle first.
      // Re-read to return the canonical id, best-effort.
      const existing = await readV9ActionClosuresByCycle(db, request.cycleId);
      return { id: existing.rows[0]?.id ?? request.closureId, idempotent: true };
    }
    return makeDegraded(
      "state_unreadable",
      request.sourceRefs,
      `Closure write failed: ${message}`,
    );
  }
}

export interface V9NoActionClosureOptions {
  now?: string;
  traceRefs?: SourceRef[];
  activityThreadId?: string;
  activityStepId?: string;
}

export async function recordV9NoActionClosure(
  db: StateDatabase,
  cycleId: string,
  cycleSequence: number,
  reasonCode: V9ReasonCode,
  options: V9NoActionClosureOptions = {},
): Promise<V9ClosureRecordResult | DegradedOperationResult> {
  const closureId = `cls_v9_no_${cycleId}`;
  return recordV9ActionClosure(db, {
    cycleId,
    cycleSequence,
    closureId,
    actionKind: "no_action",
    decision: "deny",
    reasonCode,
    sourceRefs: options.traceRefs ?? [],
    traceRefs: options.traceRefs ?? [],
    payload: { noAction: true },
    activityThreadId: options.activityThreadId,
    activityStepId: options.activityStepId,
    createdAt: options.now,
  });
}

// ───────────────────────────────────────────────────────────────
// Policy outcome helper
// ───────────────────────────────────────────────────────────────

export interface V9PolicyOutcomeClosureOptions {
  now?: string;
  activityThreadId?: string;
  activityStepId?: string;
  routineInvocationId?: string;
  routineVersion?: string;
}

export async function recordV9PolicyOutcomeClosure(
  db: StateDatabase,
  cycleId: string,
  cycleSequence: number,
  actionKind: ActionClosureActionKind,
  decision: ActionClosureDecision,
  reasonCode: V9ReasonCode,
  params: {
    intentId?: string;
    platformId?: string;
    capabilityId?: string;
    sourceRefs?: SourceRef[];
    proofRefs?: SourceRef[];
    traceRefs?: SourceRef[];
    payload?: Record<string, unknown>;
  },
  options: V9PolicyOutcomeClosureOptions = {},
): Promise<V9ClosureRecordResult | DegradedOperationResult> {
  const closureId = `cls_v9_${actionKind}_${cycleId}`;
  return recordV9ActionClosure(db, {
    cycleId,
    cycleSequence,
    closureId,
    actionKind,
    decision,
    reasonCode,
    intentId: params.intentId,
    platformId: params.platformId,
    capabilityId: params.capabilityId,
    sourceRefs: params.sourceRefs ?? [],
    proofRefs: params.proofRefs,
    traceRefs: params.traceRefs,
    payload: { cycleSequence, ...params.payload },
    activityThreadId: options.activityThreadId,
    activityStepId: options.activityStepId,
    routineInvocationId: options.routineInvocationId,
    routineVersion: options.routineVersion,
    createdAt: options.now,
  });
}
