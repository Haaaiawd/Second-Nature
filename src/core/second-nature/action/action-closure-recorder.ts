/**
 * ActionClosureRecorder — Record heartbeat cycle closure outcomes.
 *
 * Core logic: Write ActionClosureRecord for no-action, completed, denied,
 * deferred, downgraded, and failed outcomes. Handles idempotent retry
 * and remember-for-review memory candidates.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/action-closure-policy-system.detail.md §3.4`
 * - `.anws/v8/04_SYSTEM_DESIGN/action-closure-policy-system.md §4.2`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (writeActionClosureRecord, readActionClosuresByCycle)
 * - `src/shared/types/v8-contracts.js` (SourceRef, DegradedOperationResult, V8ReasonCode)
 *
 * Boundary:
 * - Does not execute actions; only records outcomes.
 * - Does not form long-term memory; only emits review intent.
 * - Degrades gracefully on DB failure.
 *
 * Test coverage: tests/unit/action/action-closure-recorder.test.ts
 */

import type { StateDatabase } from "../../../storage/db/index.js";
import {
  writeActionClosureRecord,
  readActionClosuresByCycle,
} from "../../../storage/v8-state-stores.js";
import type {
  SourceRef,
  DegradedOperationResult,
  V8ReasonCode,
  MemoryReviewCandidateClosure,
} from "../../../shared/types/v8-contracts.js";

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

export type ClosureStatus =
  | "completed"
  | "no_action"
  | "denied"
  | "deferred"
  | "downgraded"
  | "failed";

export interface ActionClosureRecord {
  id: string;
  cycleId: string;
  proposalId?: string;
  decisionId?: string;
  idempotencyKey?: string;
  retryOfClosureId?: string;
  dispatchAttempt: number;
  closureStatus: ClosureStatus;
  inputSummary: string;
  outputSummary?: string;
  postProcessing: string[];
  nextState: string;
  reason: V8ReasonCode;
  sourceRefs: SourceRef[];
  memoryReviewCandidate?: MemoryReviewCandidateClosure;
  closedAt: string;
}

export interface RecordClosureOptions {
  now?: string;
  platformId?: string;
  capabilityId?: string;
}

export type RecordClosureResult =
  | { status: "recorded"; closureId: string }
  | { status: "idempotent"; closureId: string }
  | DegradedOperationResult;

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

function buildInputSummary(
  proposalId?: string,
  decisionId?: string,
): string {
  const parts: string[] = [];
  if (proposalId) parts.push(`proposal=${proposalId}`);
  if (decisionId) parts.push(`decision=${decisionId}`);
  return parts.join(" ") || "no-action";
}

// ───────────────────────────────────────────────────────────────
// Public API — No action
// ───────────────────────────────────────────────────────────────

export async function recordNoActionClosure(
  db: StateDatabase,
  cycleId: string,
  noActionReason: V8ReasonCode,
  options?: RecordClosureOptions,
): Promise<RecordClosureResult> {
  const now = options?.now ?? new Date().toISOString();
  const closureId = `cls_no_${cycleId}`;

  const existing = await readActionClosuresByCycle(db, cycleId);
  if (!existing.degraded && existing.rows.some((r) => r.status === "no_action")) {
    return { status: "idempotent", closureId };
  }

  const result = await writeActionClosureRecord(db, {
    id: closureId,
    createdAt: now,
    cycleId,
    platformId: "heartbeat",
    status: "no_action",
    reason: noActionReason,
    nextState: "await_next_cycle",
    sourceRefs: [
      {
        uri: `sn://closure/no_action/${cycleId}`,
        family: "action_closure",
        id: cycleId,
        redactionClass: "none",
        resolveStatus: "resolvable",
      },
    ],
    redactionClass: "none",
    lifecycleStatus: "closed",
    payloadJson: JSON.stringify({ dispatchAttempt: 0, inputSummary: "no-action" }),
  });

  if ("reason" in result) {
    return result;
  }

  return { status: "recorded", closureId };
}

// ───────────────────────────────────────────────────────────────
// Public API — Remember for review
// ───────────────────────────────────────────────────────────────

export async function recordRememberClosure(
  db: StateDatabase,
  cycleId: string,
  memoryReviewCandidate: MemoryReviewCandidateClosure,
  options?: RecordClosureOptions,
): Promise<RecordClosureResult> {
  const now = options?.now ?? new Date().toISOString();
  const closureId = `cls_remember_${cycleId}_${now.replace(/[:.]/g, "")}`;

  const result = await writeActionClosureRecord(db, {
    id: closureId,
    createdAt: now,
    cycleId,
    platformId: options?.platformId ?? "heartbeat",
    capabilityId: options?.capabilityId,
    status: "completed",
    reason: "remember_for_review",
    nextState: "pending_daily_review",
    sourceRefs: memoryReviewCandidate.sourceRefs,
    redactionClass: "none",
    lifecycleStatus: "closed",
    payloadJson: JSON.stringify({
      memoryReviewCandidate,
      dispatchAttempt: 1,
      inputSummary: `remember_for_review topic=${memoryReviewCandidate.topicKey}`,
    }),
  });

  if ("reason" in result) {
    return result;
  }

  return { status: "recorded", closureId };
}

// ───────────────────────────────────────────────────────────────
// Public API — Policy decision outcome
// ───────────────────────────────────────────────────────────────

export async function recordPolicyOutcomeClosure(
  db: StateDatabase,
  cycleId: string,
  closureStatus: ClosureStatus,
  reason: V8ReasonCode,
  params: {
    proposalId?: string;
    decisionId?: string;
    platformId?: string;
    capabilityId?: string;
    downgradedActionKind?: string;
    postProcessing?: string[];
    nextState?: string;
  },
  options?: RecordClosureOptions,
): Promise<RecordClosureResult> {
  const now = options?.now ?? new Date().toISOString();
  const closureId = `cls_${closureStatus}_${cycleId}_${now.replace(/[:.]/g, "")}`;

  const sourceRefs: SourceRef[] = [
    {
      uri: `sn://closure/${closureStatus}/${cycleId}`,
      family: "action_closure",
      id: cycleId,
      redactionClass: "none",
      resolveStatus: "resolvable",
    },
  ];

  if (params.decisionId) {
    sourceRefs.push({
      uri: `sn://decision/${params.decisionId}`,
      family: "action_closure",
      id: params.decisionId,
      redactionClass: "none",
      resolveStatus: "resolvable",
    });
  }

  const result = await writeActionClosureRecord(db, {
    id: closureId,
    createdAt: now,
    cycleId,
    platformId: params.platformId ?? "heartbeat",
    capabilityId: params.capabilityId,
    proposalId: params.proposalId,
    decisionId: params.decisionId,
    status: closureStatus,
    reason,
    nextState: params.nextState ?? "await_next_cycle",
    sourceRefs,
    redactionClass: "none",
    lifecycleStatus: "closed",
    payloadJson: JSON.stringify({
      dispatchAttempt: 1,
      inputSummary: buildInputSummary(params.proposalId, params.decisionId),
      postProcessing: params.postProcessing ?? [],
      downgradedActionKind: params.downgradedActionKind,
    }),
  });

  if ("reason" in result) {
    return result;
  }

  return { status: "recorded", closureId };
}

// ───────────────────────────────────────────────────────────────
// Public API — Execution outcome
// ───────────────────────────────────────────────────────────────

export async function recordExecutionClosure(
  db: StateDatabase,
  cycleId: string,
  closureStatus: "completed" | "failed",
  reason: V8ReasonCode,
  params: {
    proposalId: string;
    decisionId: string;
    platformId?: string;
    capabilityId?: string;
    executionResultRef?: string;
    outputSummary?: string;
    nextState?: string;
    retryable?: boolean;
  },
  options?: RecordClosureOptions,
): Promise<RecordClosureResult> {
  const now = options?.now ?? new Date().toISOString();
  const closureId = `cls_exec_${closureStatus}_${cycleId}_${now.replace(/[:.]/g, "")}`;

  const sourceRefs: SourceRef[] = [
    {
      uri: `sn://closure/${closureStatus}/${cycleId}`,
      family: "action_closure",
      id: cycleId,
      redactionClass: "none",
      resolveStatus: "resolvable",
    },
  ];

  const result = await writeActionClosureRecord(db, {
    id: closureId,
    createdAt: now,
    cycleId,
    platformId: params.platformId ?? "heartbeat",
    capabilityId: params.capabilityId,
    proposalId: params.proposalId,
    decisionId: params.decisionId,
    status: closureStatus,
    reason,
    nextState: params.nextState ?? (closureStatus === "completed" ? "await_next_cycle" : "retryable"),
    sourceRefs,
    redactionClass: "none",
    lifecycleStatus: "closed",
    payloadJson: JSON.stringify({
      dispatchAttempt: 1,
      executionResultRef: params.executionResultRef,
      outputSummary: params.outputSummary,
      inputSummary: buildInputSummary(params.proposalId, params.decisionId),
      retryable: params.retryable ?? closureStatus === "failed",
    }),
  });

  if ("reason" in result) {
    return result;
  }

  return { status: "recorded", closureId };
}
