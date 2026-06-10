/**
 * MemoryProjectionLifecycle — Manage accepted long-term memory projections.
 *
 * Core logic: Accept, activate, supersede, and reject projections.
 * When accepting a projection on a topic with existing active projection,
 * supersede the old one.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.detail.md §3.4`
 * - `.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.md §4.2`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (readMemoryProjectionsByTopic, writeLongTermMemoryProjection)
 * - `src/shared/types/v8-contracts.js` (SourceRef, DegradedOperationResult, V8ReasonCode)
 *
 * Boundary:
 * - Only accepts projections with source refs.
 * - Supersedes old active projections on same topic automatically.
 * - Does not delete projections; only transitions status.
 *
 * Test coverage: tests/unit/dream/memory-projection-lifecycle.test.ts
 */

import type { StateDatabase } from "../../../storage/db/index.js";
import {
  readMemoryProjectionsByTopic,
  writeLongTermMemoryProjection,
  updateLongTermMemoryProjectionStatus,
} from "../../../storage/v8-state-stores.js";
import type {
  SourceRef,
  DegradedOperationResult,
  V8ReasonCode,
} from "../../../shared/types/v8-contracts.js";

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

export interface ProjectionLifecycleResult {
  projectionId: string;
  status: "accepted" | "rejected" | "superseded" | "retired";
  reason: V8ReasonCode;
  supersedesProjectionId?: string;
}

export interface AcceptMemoryProjectionOptions {
  now?: string;
}

// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────

export async function acceptMemoryProjection(
  db: StateDatabase,
  candidateId: string,
  topicKey: string,
  memoryText: string,
  sourceRefs: SourceRef[],
  options?: AcceptMemoryProjectionOptions,
): Promise<ProjectionLifecycleResult | DegradedOperationResult> {
  const now = options?.now ?? new Date().toISOString();

  if (sourceRefs.length === 0) {
    return {
      status: "degraded",
      reason: "source_refs_unresolved",
      ownerStage: "projection",
      sourceRefs: [],
      operatorNextAction: "Acceptance requires source refs",
      retryable: false,
    };
  }

  const existing = await readMemoryProjectionsByTopic(db, topicKey);
  if (existing.degraded) {
    return existing.degraded;
  }

  // Find active projection to supersede
  const activeProjection = existing.rows.find((r) => r.status === "active" || r.status === "accepted");
  let supersedesId: string | undefined;

  if (activeProjection) {
    // Supersede existing active projection — UPDATE instead of INSERT
    const supersedeResult = await updateLongTermMemoryProjectionStatus(
      db,
      activeProjection.id,
      "superseded",
      JSON.stringify({
        ...parsePayloadJson(activeProjection.payloadJson),
        supersededAt: now,
        supersededBy: candidateId,
      }),
    );

    if ("reason" in supersedeResult) {
      return supersedeResult;
    }

    supersedesId = activeProjection.id;
  }

  // Create new accepted/active projection
  const projectionId = `proj_${candidateId}_${now.replace(/[:.]/g, "")}`;
  const writeResult = await writeLongTermMemoryProjection(db, {
    id: projectionId,
    createdAt: now,
    candidateId,
    topicKey,
    status: "active",
    sourceRefs,
    redactionClass: "none",
    lifecycleStatus: "active",
    payloadJson: JSON.stringify({
      memoryText,
      acceptedAt: now,
      supersedesProjectionId: supersedesId,
    }),
  });

  if ("reason" in writeResult) {
    return writeResult;
  }

  return {
    projectionId,
    status: "accepted",
    reason: "projection_accepted",
    supersedesProjectionId: supersedesId,
  };
}

export async function rejectMemoryProjection(
  db: StateDatabase,
  projectionId: string,
  candidateId: string,
  topicKey: string,
  sourceRefs: SourceRef[],
  reason: V8ReasonCode = "projection_rejected",
  options?: AcceptMemoryProjectionOptions,
): Promise<ProjectionLifecycleResult | DegradedOperationResult> {
  const now = options?.now ?? new Date().toISOString();

  const writeResult = await writeLongTermMemoryProjection(db, {
    id: projectionId,
    createdAt: now,
    candidateId,
    topicKey,
    status: "rejected",
    sourceRefs,
    redactionClass: "none",
    lifecycleStatus: "rejected",
    payloadJson: JSON.stringify({ rejectedAt: now, reason }),
  });

  if ("reason" in writeResult) {
    return writeResult;
  }

  return {
    projectionId,
    status: "rejected",
    reason,
  };
}

export async function retireMemoryProjection(
  db: StateDatabase,
  projectionId: string,
  candidateId: string,
  topicKey: string,
  sourceRefs: SourceRef[],
  options?: AcceptMemoryProjectionOptions,
): Promise<ProjectionLifecycleResult | DegradedOperationResult> {
  const now = options?.now ?? new Date().toISOString();

  const writeResult = await writeLongTermMemoryProjection(db, {
    id: projectionId,
    createdAt: now,
    candidateId,
    topicKey,
    status: "retired",
    sourceRefs,
    redactionClass: "none",
    lifecycleStatus: "retired",
    payloadJson: JSON.stringify({ retiredAt: now }),
  });

  if ("reason" in writeResult) {
    return writeResult;
  }

  return {
    projectionId,
    status: "retired",
    reason: "projection_rejected",
  };
}

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

function parseSourceRefs(json: string | null): SourceRef[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parsePayloadJson(json: string | null): Record<string, unknown> {
  if (!json) return {};
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}
