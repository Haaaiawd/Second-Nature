/**
 * v8 State Stores — Bounded write/read ports for Living Perception Loop entities.
 *
 * Core logic: Persist and retrieve EvidenceItem, PerceptionCard, JudgmentVerdict,
 * ActionClosureRecord, QuietDailyReview, DreamConsolidationRun,
 * LongTermMemoryProjection, HeartbeatCycleTrace, and LoopStageEvent.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/state-memory-system.md`
 * - `.anws/v8/04_SYSTEM_DESIGN/shared-v8-contracts.md`
 *
 * Dependencies:
 * - drizzle-orm (SQLite)
 * - `src/storage/db/schema/v8-entities.js`
 * - `src/shared/types/v8-contracts.js` (SourceRef, DegradedOperationResult)
 *
 * Boundary:
 * - Write validation: rejects missing source refs, checks redaction class.
 * - Read models: bounded by family + status filters; no cross-family joins.
 * - Degraded state: returns DegradedOperationResult on DB failure, never throws.
 *
 * Test coverage: tests/unit/storage/v8-state-stores.test.ts
 */

import { eq, and, desc, like, isNull, inArray, sql } from "drizzle-orm";
import type { StateDatabase } from "./db/index.js";
import {
  evidenceItem,
  perceptionCard,
  judgmentVerdict,
  actionClosureRecord,
  quietDailyReview,
  dreamConsolidationRun,
  longTermMemoryProjection,
  heartbeatCycleTrace,
  loopStageEvent,
  impulseContextArtifact,
  dailyRhythmState,
  connectorCooldownState,
  type EvidenceItemRecord,
  type NewEvidenceItemRecord,
  type PerceptionCardRecord,
  type NewPerceptionCardRecord,
  type JudgmentVerdictRecord,
  type NewJudgmentVerdictRecord,
  type ActionClosureRecordSelect,
  type ActionClosureRecordInsert,
  type QuietDailyReviewRecord,
  type NewQuietDailyReviewRecord,
  type DreamConsolidationRunRecord,
  type NewDreamConsolidationRunRecord,
  type LongTermMemoryProjectionRecord,
  type NewLongTermMemoryProjectionRecord,
  type HeartbeatCycleTraceRecord,
  type NewHeartbeatCycleTraceRecord,
  type LoopStageEventRecord,
  type NewLoopStageEventRecord,
  type ImpulseContextArtifactRecord,
  type NewImpulseContextArtifactRecord,
  type DailyRhythmStateRecord,
  type NewDailyRhythmStateRecord,
  type ConnectorCooldownStateRecord,
  type NewConnectorCooldownStateRecord,
} from "./db/schema/v8-entities.js";

import type {
  SourceRef,
  DegradedOperationResult,
} from "../shared/types/v8-contracts.js";
import {
  serializeSourceRefs,
  parseSourceRefs,
} from "../shared/serialization.js";
import { classifyDegradedStatus } from "../shared/degraded-status-classifier.js";

// ───────────────────────────────────────────────────────────────
// Shared helpers
// ───────────────────────────────────────────────────────────────

function makeDegraded(
  reason: DegradedOperationResult["reason"],
  ownerStage: DegradedOperationResult["ownerStage"],
  operatorNextAction: string,
  sourceRefs: SourceRef[] = [],
): DegradedOperationResult {
  return {
    status: classifyDegradedStatus(reason),
    reason,
    ownerStage,
    sourceRefs,
    operatorNextAction,
    retryable: true,
  };
}

// ───────────────────────────────────────────────────────────────
// Write validation
// ───────────────────────────────────────────────────────────────

export interface WriteValidationError {
  ok: false;
  degraded: DegradedOperationResult;
}

export interface WriteValidationOk<T> {
  ok: true;
  record: T;
}

export type WriteValidationResult<T> = WriteValidationOk<T> | WriteValidationError;

function validateSourceRefs(
  sourceRefs: SourceRef[] | undefined,
  ownerStage: DegradedOperationResult["ownerStage"],
): WriteValidationResult<SourceRef[]> {
  if (!sourceRefs || sourceRefs.length === 0) {
    return {
      ok: false,
      degraded: makeDegraded(
        "source_refs_unresolved",
        ownerStage,
        "Ensure caller supplies at least one SourceRef",
      ),
    };
  }
  return { ok: true, record: sourceRefs };
}

// ───────────────────────────────────────────────────────────────
// EvidenceItem store
// ───────────────────────────────────────────────────────────────

export async function writeEvidenceItem(
  db: StateDatabase,
  row: Omit<NewEvidenceItemRecord, "sourceRefsJson"> & { sourceRefs: SourceRef[] },
): Promise<{ id: string } | DegradedOperationResult> {
  const validated = validateSourceRefs(row.sourceRefs, "ingestion");
  if (!validated.ok) return validated.degraded;

  try {
    const { sourceRefs: _, ...rest } = row;
    const identityKey = rest.stableIdentityKey ?? (rest.externalId ?? rest.contentHash ?? "");
    const identityStatus =
      rest.rowIdentityStatus ??
      (rest.externalId ? "stable" : rest.contentHash ? "unstable" : "unstable");
    const record: NewEvidenceItemRecord = {
      ...rest,
      stableIdentityKey: identityKey,
      firstObservedAt: rest.firstObservedAt ?? rest.observedAt,
      lastObservedAt: rest.lastObservedAt ?? rest.observedAt,
      seenCount: rest.seenCount ?? 1,
      rowIdentityStatus: identityStatus,
      sourceRefsJson: serializeSourceRefs(validated.record),
    };
    await db.db
      .insert(evidenceItem)
      .values(record)
      .onConflictDoUpdate({
        target: [evidenceItem.platformId, evidenceItem.contentHash],
        set: {
          payloadJson: record.payloadJson,
          observedAt: record.observedAt,
          lastObservedAt: record.observedAt,
          seenCount: sql`COALESCE(seen_count, 1) + 1`,
        },
      });
    return { id: row.id };
  } catch {
    return makeDegraded(
      "state_unreadable",
      "ingestion",
      "Retry evidence write after DB recovery",
      validated.record,
    );
  }
}

export async function readEvidenceItemsByStatus(
  db: StateDatabase,
  lifecycleStatus: EvidenceItemRecord["lifecycleStatus"],
): Promise<{ rows: EvidenceItemRecord[]; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(evidenceItem)
      .where(eq(evidenceItem.lifecycleStatus, lifecycleStatus))
      .orderBy(desc(evidenceItem.createdAt));
    return { rows };
  } catch {
    return {
      rows: [],
      degraded: makeDegraded(
        "state_unreadable",
        "ingestion",
        "Check state database connectivity",
      ),
    };
  }
}

export async function readEvidenceItemsByDay(
  db: StateDatabase,
  day: string,
): Promise<{ rows: EvidenceItemRecord[]; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(evidenceItem)
      .where(like(evidenceItem.observedAt, `${day}%`))
      .orderBy(desc(evidenceItem.observedAt));
    return { rows };
  } catch {
    return {
      rows: [],
      degraded: makeDegraded(
        "state_unreadable",
        "ingestion",
        `Check state database connectivity for evidence day=${day}`,
      ),
    };
  }
}

export async function updateEvidenceItemLifecycleStatus(
  db: StateDatabase,
  id: string,
  lifecycleStatus: EvidenceItemRecord["lifecycleStatus"],
): Promise<{ id: string } | DegradedOperationResult> {
  try {
    await db.db
      .update(evidenceItem)
      .set({ lifecycleStatus })
      .where(eq(evidenceItem.id, id));
    return { id };
  } catch {
    return makeDegraded(
      "state_unreadable",
      "ingestion",
      `Retry evidence lifecycle update for ${id} after DB recovery`,
    );
  }
}

export async function readEvidenceItemById(
  db: StateDatabase,
  id: string,
): Promise<{ row: EvidenceItemRecord | undefined } | DegradedOperationResult> {
  try {
    const rows = await db.db
      .select()
      .from(evidenceItem)
      .where(eq(evidenceItem.id, id))
      .limit(1);
    return { row: rows[0] };
  } catch {
    return makeDegraded(
      "state_unreadable",
      "ingestion",
      "Check state database connectivity",
    );
  }
}

// ───────────────────────────────────────────────────────────────
// PerceptionCard store
// ───────────────────────────────────────────────────────────────

const CANONICAL_NOVELTY_CLASSES = ["new", "changed", "duplicate", "stale"];
const CANONICAL_RELEVANCE_CLASSES = ["low", "medium", "high"];

function validatePerceptionCardCanonical(
  row: Omit<NewPerceptionCardRecord, "sourceRefsJson"> & { sourceRefs: SourceRef[] },
): { ok: true } | { ok: false; degraded: DegradedOperationResult } {
  // Validate noveltyClass
  if (row.novelty && !CANONICAL_NOVELTY_CLASSES.includes(row.novelty)) {
    return {
      ok: false,
      degraded: {
        status: classifyDegradedStatus("perception_contract_drift"),
        reason: "perception_contract_drift",
        ownerStage: "perception",
        sourceRefs: row.sourceRefs,
        operatorNextAction: `novelty "${row.novelty}" is not canonical. Expected one of: ${CANONICAL_NOVELTY_CLASSES.join(", ")}`,
        retryable: false,
      },
    };
  }

  // Validate relevanceScore range
  if (row.relevance !== undefined && row.relevance !== null) {
    if (row.relevance < 0 || row.relevance > 1) {
      return {
        ok: false,
        degraded: {
          status: classifyDegradedStatus("perception_contract_drift"),
          reason: "perception_contract_drift",
          ownerStage: "perception",
          sourceRefs: row.sourceRefs,
          operatorNextAction: `relevanceScore ${row.relevance} out of range [0, 1]`,
          retryable: false,
        },
      };
    }
  }

  // Validate relevanceClass
  if (row.relevanceClass && !CANONICAL_RELEVANCE_CLASSES.includes(row.relevanceClass)) {
    return {
      ok: false,
      degraded: {
        status: classifyDegradedStatus("perception_contract_drift"),
        reason: "perception_contract_drift",
        ownerStage: "perception",
        sourceRefs: row.sourceRefs,
        operatorNextAction: `relevanceClass "${row.relevanceClass}" is not canonical. Expected one of: ${CANONICAL_RELEVANCE_CLASSES.join(", ")}`,
        retryable: false,
      },
    };
  }

  return { ok: true };
}

export async function writePerceptionCard(
  db: StateDatabase,
  row: Omit<NewPerceptionCardRecord, "sourceRefsJson"> & { sourceRefs: SourceRef[] },
): Promise<{ id: string } | DegradedOperationResult> {
  const validated = validateSourceRefs(row.sourceRefs, "perception");
  if (!validated.ok) return validated.degraded;

  const canonicalCheck = validatePerceptionCardCanonical(row);
  if (!canonicalCheck.ok) return canonicalCheck.degraded;

  try {
    const { sourceRefs: _, ...rest } = row;
    const record: NewPerceptionCardRecord = {
      ...rest,
      sourceRefsJson: serializeSourceRefs(validated.record),
    };
    await db.db.insert(perceptionCard).values(record);
    return { id: row.id };
  } catch {
    return makeDegraded(
      "state_unreadable",
      "perception",
      "Retry perception write after DB recovery",
      validated.record,
    );
  }
}

export async function readPerceptionCardsByCycle(
  db: StateDatabase,
  cycleId: string,
): Promise<{ rows: PerceptionCardRecord[]; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(perceptionCard)
      .where(eq(perceptionCard.cycleId, cycleId))
      .orderBy(desc(perceptionCard.createdAt));
    return { rows };
  } catch {
    return {
      rows: [],
      degraded: makeDegraded(
        "state_unreadable",
        "perception",
        "Check state database connectivity",
      ),
    };
  }
}

export async function readPerceptionCardsByDay(
  db: StateDatabase,
  day: string,
): Promise<{ rows: PerceptionCardRecord[]; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(perceptionCard)
      .where(like(perceptionCard.createdAt, `${day}%`))
      .orderBy(desc(perceptionCard.createdAt));
    return { rows };
  } catch {
    return {
      rows: [],
      degraded: makeDegraded(
        "state_unreadable",
        "perception",
        `Check state database connectivity for perception day=${day}`,
      ),
    };
  }
}

export async function readPerceptionCardById(
  db: StateDatabase,
  id: string,
): Promise<{ row?: PerceptionCardRecord; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(perceptionCard)
      .where(eq(perceptionCard.id, id))
      .limit(1);
    return { row: rows[0] };
  } catch {
    return {
      degraded: makeDegraded(
        "state_unreadable",
        "perception",
        "Check state database connectivity",
      ),
    };
  }
}

// ───────────────────────────────────────────────────────────────
// JudgmentVerdict store
// ───────────────────────────────────────────────────────────────

export async function writeJudgmentVerdict(
  db: StateDatabase,
  row: Omit<NewJudgmentVerdictRecord, "sourceRefsJson"> & { sourceRefs: SourceRef[] },
): Promise<{ id: string } | DegradedOperationResult> {
  const validated = validateSourceRefs(row.sourceRefs, "judgment");
  if (!validated.ok) return validated.degraded;

  try {
    const { sourceRefs: _, ...rest } = row;
    const record: NewJudgmentVerdictRecord = {
      ...rest,
      sourceRefsJson: serializeSourceRefs(validated.record),
    };
    await db.db.insert(judgmentVerdict).values(record);
    return { id: row.id };
  } catch {
    return makeDegraded(
      "state_unreadable",
      "judgment",
      "Retry judgment write after DB recovery",
      validated.record,
    );
  }
}

export async function readJudgmentVerdictsByCycle(
  db: StateDatabase,
  cycleId: string,
): Promise<{ rows: JudgmentVerdictRecord[]; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(judgmentVerdict)
      .where(eq(judgmentVerdict.cycleId, cycleId))
      .orderBy(desc(judgmentVerdict.createdAt));
    return { rows };
  } catch {
    return {
      rows: [],
      degraded: makeDegraded(
        "state_unreadable",
        "judgment",
        "Check state database connectivity",
      ),
    };
  }
}

export async function readJudgmentVerdictById(
  db: StateDatabase,
  id: string,
): Promise<{ row?: JudgmentVerdictRecord; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(judgmentVerdict)
      .where(eq(judgmentVerdict.id, id))
      .limit(1);
    return { row: rows[0] };
  } catch {
    return {
      degraded: makeDegraded(
        "state_unreadable",
        "judgment",
        "Check state database connectivity",
      ),
    };
  }
}

// ───────────────────────────────────────────────────────────────
// ActionClosureRecord store
// ───────────────────────────────────────────────────────────────

export async function writeActionClosureRecord(
  db: StateDatabase,
  row: Omit<ActionClosureRecordInsert, "sourceRefsJson" | "proofRefsJson" | "traceRefsJson" | "payloadJson"> & {
    sourceRefs: SourceRef[];
    proofRefs?: SourceRef[];
    traceRefs?: SourceRef[];
    payload?: Record<string, unknown>;
  },
): Promise<{ id: string } | DegradedOperationResult> {
  const validated = validateSourceRefs(row.sourceRefs, "closure");
  if (!validated.ok) return validated.degraded;

  try {
    const { sourceRefs: _, proofRefs, traceRefs, payload, ...rest } = row;
    const record: ActionClosureRecordInsert = {
      ...rest,
      sourceRefsJson: serializeSourceRefs(validated.record),
      proofRefsJson: serializeSourceRefs(proofRefs ?? []),
      traceRefsJson: serializeSourceRefs(traceRefs ?? []),
      payloadJson: JSON.stringify(payload ?? {}),
    };
    await db.db.insert(actionClosureRecord).values(record);
    return { id: row.id };
  } catch {
    return makeDegraded(
      "state_unreadable",
      "closure",
      "Retry closure write after DB recovery",
      validated.record,
    );
  }
}

export async function readActionClosuresByCycle(
  db: StateDatabase,
  cycleId: string,
): Promise<{ rows: ActionClosureRecordSelect[]; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(actionClosureRecord)
      .where(eq(actionClosureRecord.cycleId, cycleId))
      .orderBy(desc(actionClosureRecord.createdAt));
    return { rows };
  } catch {
    return {
      rows: [],
      degraded: makeDegraded(
        "state_unreadable",
        "closure",
        "Check state database connectivity",
      ),
    };
  }
}

export async function readActionClosuresByDay(
  db: StateDatabase,
  day: string,
): Promise<{ rows: ActionClosureRecordSelect[]; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(actionClosureRecord)
      .where(like(actionClosureRecord.createdAt, `${day}%`))
      .orderBy(desc(actionClosureRecord.createdAt));
    return { rows };
  } catch {
    return {
      rows: [],
      degraded: makeDegraded(
        "state_unreadable",
        "closure",
        "Check state database connectivity",
      ),
    };
  }
}

// ───────────────────────────────────────────────────────────────
// QuietDailyReview store
// ───────────────────────────────────────────────────────────────

export async function writeQuietDailyReview(
  db: StateDatabase,
  row: Omit<NewQuietDailyReviewRecord, "sourceRefsJson" | "closureRefsJson"> & { sourceRefs: SourceRef[]; closureRefs?: SourceRef[] },
): Promise<{ id: string } | DegradedOperationResult> {
  const validated = validateSourceRefs(row.sourceRefs, "quiet");
  if (!validated.ok) return validated.degraded;

  try {
    const { sourceRefs: _, closureRefs, ...rest } = row;
    const record: NewQuietDailyReviewRecord = {
      ...rest,
      sourceRefsJson: serializeSourceRefs(validated.record),
      closureRefsJson: closureRefs ? serializeSourceRefs(closureRefs) : null,
    };
    await db.db.insert(quietDailyReview).values(record);
    return { id: row.id };
  } catch {
    return makeDegraded(
      "state_unreadable",
      "quiet",
      "Retry Quiet write after DB recovery",
      validated.record,
    );
  }
}

export async function readQuietDailyReviewById(
  db: StateDatabase,
  id: string,
): Promise<{ row?: QuietDailyReviewRecord; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(quietDailyReview)
      .where(eq(quietDailyReview.id, id))
      .limit(1);
    return { row: rows[0] };
  } catch {
    return {
      degraded: makeDegraded(
        "state_unreadable",
        "quiet",
        "Check state database connectivity",
      ),
    };
  }
}

export async function readQuietDailyReviewsByDay(
  db: StateDatabase,
  day: string,
): Promise<{ rows: QuietDailyReviewRecord[]; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(quietDailyReview)
      .where(eq(quietDailyReview.day, day))
      .orderBy(desc(quietDailyReview.createdAt));
    return { rows };
  } catch {
    return {
      rows: [],
      degraded: makeDegraded(
        "state_unreadable",
        "quiet",
        "Check state database connectivity",
      ),
    };
  }
}

// ───────────────────────────────────────────────────────────────
// DreamConsolidationRun store
// ───────────────────────────────────────────────────────────────

export async function writeDreamConsolidationRun(
  db: StateDatabase,
  row: Omit<NewDreamConsolidationRunRecord, "sourceRefsJson"> & { sourceRefs: SourceRef[] },
): Promise<{ id: string } | DegradedOperationResult> {
  const validated = validateSourceRefs(row.sourceRefs, "dream");
  if (!validated.ok) return validated.degraded;

  try {
    const { sourceRefs: _, ...rest } = row;
    const record: NewDreamConsolidationRunRecord = {
      ...rest,
      sourceRefsJson: serializeSourceRefs(validated.record),
    };
    await db.db.insert(dreamConsolidationRun).values(record);
    return { id: row.id };
  } catch {
    return makeDegraded(
      "state_unreadable",
      "dream",
      "Retry Dream write after DB recovery",
      validated.record,
    );
  }
}

/**
 * Update an existing DreamConsolidationRun status and payload without
 * primary-key conflict. Used by the scheduler after consolidation completes.
 */
export async function updateDreamConsolidationRunStatus(
  db: StateDatabase,
  id: string,
  status: DreamConsolidationRunRecord["status"],
  options?: {
    reason?: DreamConsolidationRunRecord["reason"];
    payloadJson?: string;
  },
): Promise<{ id: string } | DegradedOperationResult> {
  try {
    const updateData: Record<string, unknown> = { status };
    if (options?.reason !== undefined) updateData.reason = options.reason;
    if (options?.payloadJson !== undefined) updateData.payloadJson = options.payloadJson;
    await db.db.update(dreamConsolidationRun).set(updateData).where(eq(dreamConsolidationRun.id, id));
    return { id };
  } catch {
    return makeDegraded(
      "state_unreadable",
      "dream",
      `Retry Dream status update for ${id} after DB recovery`,
    );
  }
}

export async function readDreamConsolidationRunById(
  db: StateDatabase,
  id: string,
): Promise<{ row?: DreamConsolidationRunRecord; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(dreamConsolidationRun)
      .where(eq(dreamConsolidationRun.id, id))
      .limit(1);
    return { row: rows[0] };
  } catch {
    return {
      degraded: makeDegraded(
        "state_unreadable",
        "dream",
        "Check state database connectivity",
      ),
    };
  }
}

export async function readDreamConsolidationRunsByQuietId(
  db: StateDatabase,
  quietReviewId: string,
): Promise<{ rows: DreamConsolidationRunRecord[]; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(dreamConsolidationRun)
      .where(eq(dreamConsolidationRun.quietReviewId, quietReviewId))
      .orderBy(desc(dreamConsolidationRun.createdAt));
    return { rows };
  } catch {
    return {
      rows: [],
      degraded: makeDegraded(
        "state_unreadable",
        "dream",
        "Check state database connectivity",
      ),
    };
  }
}

/**
 * Read the most recent DreamConsolidationRun globally, filtered by status.
 * Used to enforce the 7-day Dream interval across Quiet review IDs.
 */
export async function readLatestDreamConsolidationRunByStatus(
  db: StateDatabase,
  statuses: DreamConsolidationRunRecord["status"][],
): Promise<{ row?: DreamConsolidationRunRecord; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(dreamConsolidationRun)
      .where(inArray(dreamConsolidationRun.status, statuses))
      .orderBy(desc(dreamConsolidationRun.createdAt))
      .limit(1);
    return { row: rows[0] };
  } catch {
    return {
      degraded: makeDegraded(
        "state_unreadable",
        "dream",
        "Check state database connectivity",
      ),
    };
  }
}

// ───────────────────────────────────────────────────────────────
// LongTermMemoryProjection store
// ───────────────────────────────────────────────────────────────

export async function writeLongTermMemoryProjection(
  db: StateDatabase,
  row: Omit<NewLongTermMemoryProjectionRecord, "sourceRefsJson"> & { sourceRefs: SourceRef[] },
): Promise<{ id: string } | DegradedOperationResult> {
  const validated = validateSourceRefs(row.sourceRefs, "projection");
  if (!validated.ok) return validated.degraded;

  try {
    const { sourceRefs: _, ...rest } = row;
    const record: NewLongTermMemoryProjectionRecord = {
      ...rest,
      sourceRefsJson: serializeSourceRefs(validated.record),
    };
    await db.db.insert(longTermMemoryProjection).values(record);
    return { id: row.id };
  } catch {
    return makeDegraded(
      "state_unreadable",
      "projection",
      "Retry projection write after DB recovery",
      validated.record,
    );
  }
}

/**
 * Update an existing projection's status — required for supersession lifecycle.
 * Uses UPDATE instead of INSERT to avoid primary-key conflict.
 */
export async function updateLongTermMemoryProjectionStatus(
  db: StateDatabase,
  id: string,
  status: LongTermMemoryProjectionRecord["status"],
  payloadJson?: string,
): Promise<{ id: string } | DegradedOperationResult> {
  try {
    const updateData: Record<string, unknown> = { status };
    if (payloadJson !== undefined) {
      updateData.payloadJson = payloadJson;
    }
    await db.db.update(longTermMemoryProjection).set(updateData).where(eq(longTermMemoryProjection.id, id));
    return { id };
  } catch {
    return makeDegraded(
      "state_unreadable",
      "projection",
      `Retry projection status update for ${id} after DB recovery`,
    );
  }
}

export async function readMemoryProjectionsByStatus(
  db: StateDatabase,
  status: LongTermMemoryProjectionRecord["status"],
): Promise<{ rows: LongTermMemoryProjectionRecord[]; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(longTermMemoryProjection)
      .where(eq(longTermMemoryProjection.status, status))
      .orderBy(desc(longTermMemoryProjection.createdAt));
    return { rows };
  } catch {
    return {
      rows: [],
      degraded: makeDegraded(
        "state_unreadable",
        "projection",
        "Check state database connectivity",
      ),
    };
  }
}

export async function readMemoryProjectionsByTopic(
  db: StateDatabase,
  topicKey: string,
): Promise<{ rows: LongTermMemoryProjectionRecord[]; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(longTermMemoryProjection)
      .where(eq(longTermMemoryProjection.topicKey, topicKey))
      .orderBy(desc(longTermMemoryProjection.createdAt));
    return { rows };
  } catch {
    return {
      rows: [],
      degraded: makeDegraded(
        "state_unreadable",
        "projection",
        "Check state database connectivity",
      ),
    };
  }
}

export async function readLongTermMemoryProjectionById(
  db: StateDatabase,
  id: string,
): Promise<{ row?: LongTermMemoryProjectionRecord; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(longTermMemoryProjection)
      .where(eq(longTermMemoryProjection.id, id))
      .limit(1);
    return { row: rows[0] };
  } catch {
    return {
      degraded: makeDegraded(
        "state_unreadable",
        "projection",
        `Check state database connectivity for projection ${id}`,
      ),
    };
  }
}

// ───────────────────────────────────────────────────────────────
// HeartbeatCycleTrace store
// ───────────────────────────────────────────────────────────────

export async function writeHeartbeatCycleTrace(
  db: StateDatabase,
  row: Omit<NewHeartbeatCycleTraceRecord, "sourceRefsJson"> & { sourceRefs?: SourceRef[] },
): Promise<{ id: string } | DegradedOperationResult> {
  try {
    const { sourceRefs: _, ...rest } = row;
    const record: NewHeartbeatCycleTraceRecord = {
      ...rest,
      sourceRefsJson: row.sourceRefs ? serializeSourceRefs(row.sourceRefs) : "[]",
    };
    await db.db.insert(heartbeatCycleTrace).values(record);
    return { id: row.id };
  } catch {
    return makeDegraded(
      "state_unreadable",
      "ingestion",
      "Retry cycle trace write after DB recovery",
    );
  }
}

export async function readHeartbeatCycleTraces(
  db: StateDatabase,
  limit = 100,
): Promise<{ rows: HeartbeatCycleTraceRecord[]; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(heartbeatCycleTrace)
      .orderBy(desc(heartbeatCycleTrace.cycleSequence))
      .limit(limit);
    return { rows };
  } catch {
    return {
      rows: [],
      degraded: makeDegraded(
        "state_unreadable",
        "ingestion",
        "Check state database connectivity",
      ),
    };
  }
}

// ───────────────────────────────────────────────────────────────
// LoopStageEvent store
// ───────────────────────────────────────────────────────────────

export async function writeLoopStageEvent(
  db: StateDatabase,
  row: Omit<NewLoopStageEventRecord, "sourceRefsJson" | "proofRefsJson" | "traceRefsJson"> & {
    sourceRefs: SourceRef[];
    proofRefs?: SourceRef[];
    traceRefs?: SourceRef[];
  },
): Promise<{ id: string } | DegradedOperationResult> {
  const stage = row.stage as import("../shared/types/v8-contracts.js").LoopStage;
  const validated = validateSourceRefs(row.sourceRefs, stage);
  if (!validated.ok) return validated.degraded;

  try {
    const { sourceRefs: _s, proofRefs: _p, traceRefs: _t, ...rest } = row as Record<string, unknown>;
    const record: NewLoopStageEventRecord = {
      ...(rest as Omit<typeof row, "sourceRefs" | "proofRefs" | "traceRefs">),
      sourceRefsJson: serializeSourceRefs(validated.record),
      proofRefsJson: serializeSourceRefs(row.proofRefs ?? []),
      traceRefsJson: serializeSourceRefs(row.traceRefs ?? []),
    };
    await db.db.insert(loopStageEvent).values(record);
    return { id: row.id };
  } catch (err) {
    return makeDegraded(
      "state_unreadable",
      stage,
      `Retry stage event write after DB recovery: ${err instanceof Error ? err.message : String(err)}`,
      validated.record,
    );
  }
}

export async function readLoopStageEventsByCycle(
  db: StateDatabase,
  cycleId: string,
): Promise<{ rows: LoopStageEventRecord[]; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(loopStageEvent)
      .where(eq(loopStageEvent.cycleId, cycleId))
      .orderBy(desc(loopStageEvent.occurredAt));
    return { rows };
  } catch {
    return {
      rows: [],
      degraded: makeDegraded(
        "state_unreadable",
        "closure",
        "Check state database connectivity",
      ),
    };
  }
}

export async function readLoopStageEventsByStage(
  db: StateDatabase,
  stage: LoopStageEventRecord["stage"],
  limit = 100,
): Promise<{ rows: LoopStageEventRecord[]; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(loopStageEvent)
      .where(eq(loopStageEvent.stage, stage))
      .orderBy(desc(loopStageEvent.occurredAt))
      .limit(limit);
    return { rows };
  } catch {
    return {
      rows: [],
      degraded: makeDegraded(
        "state_unreadable",
        "closure",
        "Check state database connectivity",
      ),
    };
  }
}

// ───────────────────────────────────────────────────────────────
// ImpulseContextArtifact store
// ───────────────────────────────────────────────────────────────

export async function writeImpulseContextArtifact(
  db: StateDatabase,
  row: Omit<NewImpulseContextArtifactRecord, "sourceRefsJson"> & { sourceRefs: SourceRef[] },
): Promise<{ id: string } | DegradedOperationResult> {
  const validated = validateSourceRefs(row.sourceRefs, "projection");
  if (!validated.ok) return validated.degraded;

  try {
    const { sourceRefs: _, ...rest } = row;
    const record: NewImpulseContextArtifactRecord = {
      ...rest,
      sourceRefsJson: serializeSourceRefs(validated.record),
    };
    // Upsert: delete existing then insert (SQLite primary-key conflict)
    await db.db.delete(impulseContextArtifact).where(eq(impulseContextArtifact.id, row.id));
    await db.db.insert(impulseContextArtifact).values(record);
    return { id: row.id };
  } catch {
    return makeDegraded(
      "state_unreadable",
      "projection",
      "Retry impulse context write after DB recovery",
      validated.record,
    );
  }
}

export async function readImpulseContextArtifact(
  db: StateDatabase,
  sceneType: string,
  capabilityIntent?: string,
  platformId?: string,
): Promise<{ row?: ImpulseContextArtifactRecord; degraded?: DegradedOperationResult }> {
  try {
    const conditions = [eq(impulseContextArtifact.sceneType, sceneType)];
    if (capabilityIntent) {
      conditions.push(eq(impulseContextArtifact.capabilityIntent, capabilityIntent));
    } else {
      conditions.push(isNull(impulseContextArtifact.capabilityIntent));
    }
    if (platformId) {
      conditions.push(eq(impulseContextArtifact.platformId, platformId));
    } else {
      conditions.push(isNull(impulseContextArtifact.platformId));
    }

    const rows = await db.db
      .select()
      .from(impulseContextArtifact)
      .where(and(...conditions))
      .orderBy(desc(impulseContextArtifact.updatedAt))
      .limit(1);
    return { row: rows[0] };
  } catch {
    return {
      degraded: makeDegraded(
        "state_unreadable",
        "projection",
        "Check state database connectivity",
      ),
    };
  }
}

// ───────────────────────────────────────────────────────────────
// DailyRhythmState store
// ───────────────────────────────────────────────────────────────

export async function writeDailyRhythmState(
  db: StateDatabase,
  row: Omit<NewDailyRhythmStateRecord, "sourceRefsJson"> & { sourceRefs: SourceRef[] },
): Promise<{ id: string } | DegradedOperationResult> {
  const validated = validateSourceRefs(row.sourceRefs, "dream");
  if (!validated.ok) return validated.degraded;

  try {
    const { sourceRefs: _, ...rest } = row;
    const record: NewDailyRhythmStateRecord = {
      ...rest,
      sourceRefsJson: serializeSourceRefs(validated.record),
    };
    await db.db.delete(dailyRhythmState).where(eq(dailyRhythmState.id, row.id));
    await db.db.insert(dailyRhythmState).values(record);
    return { id: row.id };
  } catch {
    return makeDegraded(
      "state_unreadable",
      "dream",
      "Retry daily rhythm state write after DB recovery",
      validated.record,
    );
  }
}

export async function readDailyRhythmStateByDay(
  db: StateDatabase,
  day: string,
): Promise<{ row?: DailyRhythmStateRecord; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(dailyRhythmState)
      .where(eq(dailyRhythmState.day, day))
      .orderBy(desc(dailyRhythmState.updatedAt))
      .limit(1);
    return { row: rows[0] };
  } catch {
    return {
      degraded: makeDegraded(
        "state_unreadable",
        "dream",
        `Check state database connectivity for day=${day}`,
      ),
    };
  }
}

export async function readConnectorCooldownState(
  db: StateDatabase,
  platformId: string,
  capabilityId: string,
): Promise<{ row?: ConnectorCooldownStateRecord; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(connectorCooldownState)
      .where(
        and(
          eq(connectorCooldownState.platformId, platformId),
          eq(connectorCooldownState.capabilityId, capabilityId),
        ),
      )
      .orderBy(desc(connectorCooldownState.updatedAt))
      .limit(1);
    return { row: rows[0] };
  } catch {
    return {
      degraded: makeDegraded(
        "state_unreadable",
        "ingestion",
        `Check state database connectivity for cooldown ${platformId}:${capabilityId}`,
      ),
    };
  }
}

export async function writeConnectorCooldownState(
  db: StateDatabase,
  row: Omit<NewConnectorCooldownStateRecord, "sourceRefsJson"> & { sourceRefs: SourceRef[] },
): Promise<{ id: string } | DegradedOperationResult> {
  const validated = validateSourceRefs(row.sourceRefs, "ingestion");
  if (!validated.ok) return validated.degraded;

  try {
    const { sourceRefs: _, ...rest } = row;
    const record: NewConnectorCooldownStateRecord = {
      ...rest,
      sourceRefsJson: serializeSourceRefs(validated.record),
    };
    await db.db.delete(connectorCooldownState).where(eq(connectorCooldownState.id, row.id));
    await db.db.insert(connectorCooldownState).values(record);
    return { id: row.id };
  } catch {
    return makeDegraded(
      "state_unreadable",
      "ingestion",
      "Retry connector cooldown state write after DB recovery",
      validated.record,
    );
  }
}

// ───────────────────────────────────────────────────────────────
// SourceRef round-trip helper (for tests and consumers)
// ───────────────────────────────────────────────────────────────

export function extractSourceRefs(row: {
  sourceRefsJson: string | null;
}): SourceRef[] {
  return parseSourceRefs(row.sourceRefsJson);
}
