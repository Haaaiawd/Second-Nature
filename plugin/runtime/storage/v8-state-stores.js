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
import { eq, and, desc, like, isNull, inArray } from "drizzle-orm";
import { evidenceItem, perceptionCard, judgmentVerdict, actionClosureRecord, quietDailyReview, dreamConsolidationRun, longTermMemoryProjection, heartbeatCycleTrace, loopStageEvent, impulseContextArtifact, dailyRhythmState, connectorCooldownState, } from "./db/schema/v8-entities.js";
import { serializeSourceRefs, parseSourceRefs, } from "../shared/serialization.js";
import { classifyDegradedStatus } from "../shared/degraded-status-classifier.js";
// ───────────────────────────────────────────────────────────────
// Shared helpers
// ───────────────────────────────────────────────────────────────
function makeDegraded(reason, ownerStage, operatorNextAction, sourceRefs = []) {
    return {
        status: classifyDegradedStatus(reason),
        reason,
        ownerStage,
        sourceRefs,
        operatorNextAction,
        retryable: true,
    };
}
function validateSourceRefs(sourceRefs, ownerStage) {
    if (!sourceRefs || sourceRefs.length === 0) {
        return {
            ok: false,
            degraded: makeDegraded("source_refs_unresolved", ownerStage, "Ensure caller supplies at least one SourceRef"),
        };
    }
    return { ok: true, record: sourceRefs };
}
// ───────────────────────────────────────────────────────────────
// EvidenceItem store
// ───────────────────────────────────────────────────────────────
export async function writeEvidenceItem(db, row) {
    const validated = validateSourceRefs(row.sourceRefs, "ingestion");
    if (!validated.ok)
        return validated.degraded;
    try {
        const record = {
            ...row,
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
            },
        });
        return { id: row.id };
    }
    catch {
        return makeDegraded("state_unreadable", "ingestion", "Retry evidence write after DB recovery", validated.record);
    }
}
export async function readEvidenceItemsByStatus(db, lifecycleStatus) {
    try {
        const rows = await db.db
            .select()
            .from(evidenceItem)
            .where(eq(evidenceItem.lifecycleStatus, lifecycleStatus))
            .orderBy(desc(evidenceItem.createdAt));
        return { rows };
    }
    catch {
        return {
            rows: [],
            degraded: makeDegraded("state_unreadable", "ingestion", "Check state database connectivity"),
        };
    }
}
export async function readEvidenceItemsByDay(db, day) {
    try {
        const rows = await db.db
            .select()
            .from(evidenceItem)
            .where(like(evidenceItem.observedAt, `${day}%`))
            .orderBy(desc(evidenceItem.observedAt));
        return { rows };
    }
    catch {
        return {
            rows: [],
            degraded: makeDegraded("state_unreadable", "ingestion", `Check state database connectivity for evidence day=${day}`),
        };
    }
}
export async function updateEvidenceItemLifecycleStatus(db, id, lifecycleStatus) {
    try {
        await db.db
            .update(evidenceItem)
            .set({ lifecycleStatus })
            .where(eq(evidenceItem.id, id));
        return { id };
    }
    catch {
        return makeDegraded("state_unreadable", "ingestion", `Retry evidence lifecycle update for ${id} after DB recovery`);
    }
}
export async function readEvidenceItemById(db, id) {
    try {
        const rows = await db.db
            .select()
            .from(evidenceItem)
            .where(eq(evidenceItem.id, id))
            .limit(1);
        return { row: rows[0] };
    }
    catch {
        return makeDegraded("state_unreadable", "ingestion", "Check state database connectivity");
    }
}
// ───────────────────────────────────────────────────────────────
// PerceptionCard store
// ───────────────────────────────────────────────────────────────
const CANONICAL_NOVELTY_CLASSES = ["new", "changed", "duplicate", "stale"];
const CANONICAL_RELEVANCE_CLASSES = ["low", "medium", "high"];
function validatePerceptionCardCanonical(row) {
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
export async function writePerceptionCard(db, row) {
    const validated = validateSourceRefs(row.sourceRefs, "perception");
    if (!validated.ok)
        return validated.degraded;
    const canonicalCheck = validatePerceptionCardCanonical(row);
    if (!canonicalCheck.ok)
        return canonicalCheck.degraded;
    try {
        const record = {
            ...row,
            sourceRefsJson: serializeSourceRefs(validated.record),
        };
        await db.db.insert(perceptionCard).values(record);
        return { id: row.id };
    }
    catch {
        return makeDegraded("state_unreadable", "perception", "Retry perception write after DB recovery", validated.record);
    }
}
export async function readPerceptionCardsByCycle(db, cycleId) {
    try {
        const rows = await db.db
            .select()
            .from(perceptionCard)
            .where(eq(perceptionCard.cycleId, cycleId))
            .orderBy(desc(perceptionCard.createdAt));
        return { rows };
    }
    catch {
        return {
            rows: [],
            degraded: makeDegraded("state_unreadable", "perception", "Check state database connectivity"),
        };
    }
}
export async function readPerceptionCardsByDay(db, day) {
    try {
        const rows = await db.db
            .select()
            .from(perceptionCard)
            .where(like(perceptionCard.createdAt, `${day}%`))
            .orderBy(desc(perceptionCard.createdAt));
        return { rows };
    }
    catch {
        return {
            rows: [],
            degraded: makeDegraded("state_unreadable", "perception", `Check state database connectivity for perception day=${day}`),
        };
    }
}
export async function readPerceptionCardById(db, id) {
    try {
        const rows = await db.db
            .select()
            .from(perceptionCard)
            .where(eq(perceptionCard.id, id))
            .limit(1);
        return { row: rows[0] };
    }
    catch {
        return {
            degraded: makeDegraded("state_unreadable", "perception", "Check state database connectivity"),
        };
    }
}
// ───────────────────────────────────────────────────────────────
// JudgmentVerdict store
// ───────────────────────────────────────────────────────────────
export async function writeJudgmentVerdict(db, row) {
    const validated = validateSourceRefs(row.sourceRefs, "judgment");
    if (!validated.ok)
        return validated.degraded;
    try {
        const record = {
            ...row,
            sourceRefsJson: serializeSourceRefs(validated.record),
        };
        await db.db.insert(judgmentVerdict).values(record);
        return { id: row.id };
    }
    catch {
        return makeDegraded("state_unreadable", "judgment", "Retry judgment write after DB recovery", validated.record);
    }
}
export async function readJudgmentVerdictsByCycle(db, cycleId) {
    try {
        const rows = await db.db
            .select()
            .from(judgmentVerdict)
            .where(eq(judgmentVerdict.cycleId, cycleId))
            .orderBy(desc(judgmentVerdict.createdAt));
        return { rows };
    }
    catch {
        return {
            rows: [],
            degraded: makeDegraded("state_unreadable", "judgment", "Check state database connectivity"),
        };
    }
}
export async function readJudgmentVerdictById(db, id) {
    try {
        const rows = await db.db
            .select()
            .from(judgmentVerdict)
            .where(eq(judgmentVerdict.id, id))
            .limit(1);
        return { row: rows[0] };
    }
    catch {
        return {
            degraded: makeDegraded("state_unreadable", "judgment", "Check state database connectivity"),
        };
    }
}
// ───────────────────────────────────────────────────────────────
// ActionClosureRecord store
// ───────────────────────────────────────────────────────────────
export async function writeActionClosureRecord(db, row) {
    const validated = validateSourceRefs(row.sourceRefs, "closure");
    if (!validated.ok)
        return validated.degraded;
    try {
        const record = {
            ...row,
            sourceRefsJson: serializeSourceRefs(validated.record),
            payloadJson: JSON.stringify({
                ...(row.payload ?? {}),
                proofRefs: row.proofRefs ?? [],
                traceRefs: row.traceRefs ?? [],
            }),
        };
        await db.db.insert(actionClosureRecord).values(record);
        return { id: row.id };
    }
    catch {
        return makeDegraded("state_unreadable", "closure", "Retry closure write after DB recovery", validated.record);
    }
}
export async function readActionClosuresByCycle(db, cycleId) {
    try {
        const rows = await db.db
            .select()
            .from(actionClosureRecord)
            .where(eq(actionClosureRecord.cycleId, cycleId))
            .orderBy(desc(actionClosureRecord.createdAt));
        return { rows };
    }
    catch {
        return {
            rows: [],
            degraded: makeDegraded("state_unreadable", "closure", "Check state database connectivity"),
        };
    }
}
export async function readActionClosuresByDay(db, day) {
    try {
        const rows = await db.db
            .select()
            .from(actionClosureRecord)
            .where(like(actionClosureRecord.createdAt, `${day}%`))
            .orderBy(desc(actionClosureRecord.createdAt));
        return { rows };
    }
    catch {
        return {
            rows: [],
            degraded: makeDegraded("state_unreadable", "closure", "Check state database connectivity"),
        };
    }
}
// ───────────────────────────────────────────────────────────────
// QuietDailyReview store
// ───────────────────────────────────────────────────────────────
export async function writeQuietDailyReview(db, row) {
    const validated = validateSourceRefs(row.sourceRefs, "quiet");
    if (!validated.ok)
        return validated.degraded;
    try {
        const record = {
            ...row,
            sourceRefsJson: serializeSourceRefs(validated.record),
            closureRefsJson: row.closureRefs ? serializeSourceRefs(row.closureRefs) : null,
        };
        await db.db.insert(quietDailyReview).values(record);
        return { id: row.id };
    }
    catch {
        return makeDegraded("state_unreadable", "quiet", "Retry Quiet write after DB recovery", validated.record);
    }
}
export async function readQuietDailyReviewById(db, id) {
    try {
        const rows = await db.db
            .select()
            .from(quietDailyReview)
            .where(eq(quietDailyReview.id, id))
            .limit(1);
        return { row: rows[0] };
    }
    catch {
        return {
            degraded: makeDegraded("state_unreadable", "quiet", "Check state database connectivity"),
        };
    }
}
export async function readQuietDailyReviewsByDay(db, day) {
    try {
        const rows = await db.db
            .select()
            .from(quietDailyReview)
            .where(eq(quietDailyReview.day, day))
            .orderBy(desc(quietDailyReview.createdAt));
        return { rows };
    }
    catch {
        return {
            rows: [],
            degraded: makeDegraded("state_unreadable", "quiet", "Check state database connectivity"),
        };
    }
}
// ───────────────────────────────────────────────────────────────
// DreamConsolidationRun store
// ───────────────────────────────────────────────────────────────
export async function writeDreamConsolidationRun(db, row) {
    const validated = validateSourceRefs(row.sourceRefs, "dream");
    if (!validated.ok)
        return validated.degraded;
    try {
        const record = {
            ...row,
            sourceRefsJson: serializeSourceRefs(validated.record),
        };
        await db.db.insert(dreamConsolidationRun).values(record);
        return { id: row.id };
    }
    catch {
        return makeDegraded("state_unreadable", "dream", "Retry Dream write after DB recovery", validated.record);
    }
}
/**
 * Update an existing DreamConsolidationRun status and payload without
 * primary-key conflict. Used by the scheduler after consolidation completes.
 */
export async function updateDreamConsolidationRunStatus(db, id, status, options) {
    try {
        const updateData = { status };
        if (options?.reason !== undefined)
            updateData.reason = options.reason;
        if (options?.payloadJson !== undefined)
            updateData.payloadJson = options.payloadJson;
        await db.db.update(dreamConsolidationRun).set(updateData).where(eq(dreamConsolidationRun.id, id));
        return { id };
    }
    catch {
        return makeDegraded("state_unreadable", "dream", `Retry Dream status update for ${id} after DB recovery`);
    }
}
export async function readDreamConsolidationRunById(db, id) {
    try {
        const rows = await db.db
            .select()
            .from(dreamConsolidationRun)
            .where(eq(dreamConsolidationRun.id, id))
            .limit(1);
        return { row: rows[0] };
    }
    catch {
        return {
            degraded: makeDegraded("state_unreadable", "dream", "Check state database connectivity"),
        };
    }
}
export async function readDreamConsolidationRunsByQuietId(db, quietReviewId) {
    try {
        const rows = await db.db
            .select()
            .from(dreamConsolidationRun)
            .where(eq(dreamConsolidationRun.quietReviewId, quietReviewId))
            .orderBy(desc(dreamConsolidationRun.createdAt));
        return { rows };
    }
    catch {
        return {
            rows: [],
            degraded: makeDegraded("state_unreadable", "dream", "Check state database connectivity"),
        };
    }
}
/**
 * Read the most recent DreamConsolidationRun globally, filtered by status.
 * Used to enforce the 7-day Dream interval across Quiet review IDs.
 */
export async function readLatestDreamConsolidationRunByStatus(db, statuses) {
    try {
        const rows = await db.db
            .select()
            .from(dreamConsolidationRun)
            .where(inArray(dreamConsolidationRun.status, statuses))
            .orderBy(desc(dreamConsolidationRun.createdAt))
            .limit(1);
        return { row: rows[0] };
    }
    catch {
        return {
            degraded: makeDegraded("state_unreadable", "dream", "Check state database connectivity"),
        };
    }
}
// ───────────────────────────────────────────────────────────────
// LongTermMemoryProjection store
// ───────────────────────────────────────────────────────────────
export async function writeLongTermMemoryProjection(db, row) {
    const validated = validateSourceRefs(row.sourceRefs, "projection");
    if (!validated.ok)
        return validated.degraded;
    try {
        const record = {
            ...row,
            sourceRefsJson: serializeSourceRefs(validated.record),
        };
        await db.db.insert(longTermMemoryProjection).values(record);
        return { id: row.id };
    }
    catch {
        return makeDegraded("state_unreadable", "projection", "Retry projection write after DB recovery", validated.record);
    }
}
/**
 * Update an existing projection's status — required for supersession lifecycle.
 * Uses UPDATE instead of INSERT to avoid primary-key conflict.
 */
export async function updateLongTermMemoryProjectionStatus(db, id, status, payloadJson) {
    try {
        const updateData = { status };
        if (payloadJson !== undefined) {
            updateData.payloadJson = payloadJson;
        }
        await db.db.update(longTermMemoryProjection).set(updateData).where(eq(longTermMemoryProjection.id, id));
        return { id };
    }
    catch {
        return makeDegraded("state_unreadable", "projection", `Retry projection status update for ${id} after DB recovery`);
    }
}
export async function readMemoryProjectionsByStatus(db, status) {
    try {
        const rows = await db.db
            .select()
            .from(longTermMemoryProjection)
            .where(eq(longTermMemoryProjection.status, status))
            .orderBy(desc(longTermMemoryProjection.createdAt));
        return { rows };
    }
    catch {
        return {
            rows: [],
            degraded: makeDegraded("state_unreadable", "projection", "Check state database connectivity"),
        };
    }
}
export async function readMemoryProjectionsByTopic(db, topicKey) {
    try {
        const rows = await db.db
            .select()
            .from(longTermMemoryProjection)
            .where(eq(longTermMemoryProjection.topicKey, topicKey))
            .orderBy(desc(longTermMemoryProjection.createdAt));
        return { rows };
    }
    catch {
        return {
            rows: [],
            degraded: makeDegraded("state_unreadable", "projection", "Check state database connectivity"),
        };
    }
}
export async function readLongTermMemoryProjectionById(db, id) {
    try {
        const rows = await db.db
            .select()
            .from(longTermMemoryProjection)
            .where(eq(longTermMemoryProjection.id, id))
            .limit(1);
        return { row: rows[0] };
    }
    catch {
        return {
            degraded: makeDegraded("state_unreadable", "projection", `Check state database connectivity for projection ${id}`),
        };
    }
}
// ───────────────────────────────────────────────────────────────
// HeartbeatCycleTrace store
// ───────────────────────────────────────────────────────────────
export async function writeHeartbeatCycleTrace(db, row) {
    try {
        const record = {
            ...row,
            sourceRefsJson: row.sourceRefs ? serializeSourceRefs(row.sourceRefs) : "[]",
        };
        await db.db.insert(heartbeatCycleTrace).values(record);
        return { id: row.id };
    }
    catch {
        return makeDegraded("state_unreadable", "ingestion", "Retry cycle trace write after DB recovery");
    }
}
export async function readHeartbeatCycleTraces(db, limit = 100) {
    try {
        const rows = await db.db
            .select()
            .from(heartbeatCycleTrace)
            .orderBy(desc(heartbeatCycleTrace.cycleSequence))
            .limit(limit);
        return { rows };
    }
    catch {
        return {
            rows: [],
            degraded: makeDegraded("state_unreadable", "ingestion", "Check state database connectivity"),
        };
    }
}
// ───────────────────────────────────────────────────────────────
// LoopStageEvent store
// ───────────────────────────────────────────────────────────────
export async function writeLoopStageEvent(db, row) {
    const stage = row.stage;
    const validated = validateSourceRefs(row.sourceRefs, stage);
    if (!validated.ok)
        return validated.degraded;
    try {
        const record = {
            ...row,
            sourceRefsJson: serializeSourceRefs(validated.record),
            proofRefsJson: serializeSourceRefs(row.proofRefs ?? []),
            traceRefsJson: serializeSourceRefs(row.traceRefs ?? []),
        };
        await db.db.insert(loopStageEvent).values(record);
        return { id: row.id };
    }
    catch {
        return makeDegraded("state_unreadable", stage, "Retry stage event write after DB recovery", validated.record);
    }
}
export async function readLoopStageEventsByCycle(db, cycleId) {
    try {
        const rows = await db.db
            .select()
            .from(loopStageEvent)
            .where(eq(loopStageEvent.cycleId, cycleId))
            .orderBy(desc(loopStageEvent.occurredAt));
        return { rows };
    }
    catch {
        return {
            rows: [],
            degraded: makeDegraded("state_unreadable", "closure", "Check state database connectivity"),
        };
    }
}
export async function readLoopStageEventsByStage(db, stage, limit = 100) {
    try {
        const rows = await db.db
            .select()
            .from(loopStageEvent)
            .where(eq(loopStageEvent.stage, stage))
            .orderBy(desc(loopStageEvent.occurredAt))
            .limit(limit);
        return { rows };
    }
    catch {
        return {
            rows: [],
            degraded: makeDegraded("state_unreadable", "closure", "Check state database connectivity"),
        };
    }
}
// ───────────────────────────────────────────────────────────────
// ImpulseContextArtifact store
// ───────────────────────────────────────────────────────────────
export async function writeImpulseContextArtifact(db, row) {
    const validated = validateSourceRefs(row.sourceRefs, "projection");
    if (!validated.ok)
        return validated.degraded;
    try {
        const record = {
            ...row,
            sourceRefsJson: serializeSourceRefs(validated.record),
        };
        // Upsert: delete existing then insert (SQLite primary-key conflict)
        await db.db.delete(impulseContextArtifact).where(eq(impulseContextArtifact.id, row.id));
        await db.db.insert(impulseContextArtifact).values(record);
        return { id: row.id };
    }
    catch {
        return makeDegraded("state_unreadable", "projection", "Retry impulse context write after DB recovery", validated.record);
    }
}
export async function readImpulseContextArtifact(db, sceneType, capabilityIntent, platformId) {
    try {
        const conditions = [eq(impulseContextArtifact.sceneType, sceneType)];
        if (capabilityIntent) {
            conditions.push(eq(impulseContextArtifact.capabilityIntent, capabilityIntent));
        }
        else {
            conditions.push(isNull(impulseContextArtifact.capabilityIntent));
        }
        if (platformId) {
            conditions.push(eq(impulseContextArtifact.platformId, platformId));
        }
        else {
            conditions.push(isNull(impulseContextArtifact.platformId));
        }
        const rows = await db.db
            .select()
            .from(impulseContextArtifact)
            .where(and(...conditions))
            .orderBy(desc(impulseContextArtifact.updatedAt))
            .limit(1);
        return { row: rows[0] };
    }
    catch {
        return {
            degraded: makeDegraded("state_unreadable", "projection", "Check state database connectivity"),
        };
    }
}
// ───────────────────────────────────────────────────────────────
// DailyRhythmState store
// ───────────────────────────────────────────────────────────────
export async function writeDailyRhythmState(db, row) {
    const validated = validateSourceRefs(row.sourceRefs, "dream");
    if (!validated.ok)
        return validated.degraded;
    try {
        const record = {
            ...row,
            sourceRefsJson: serializeSourceRefs(validated.record),
        };
        await db.db.delete(dailyRhythmState).where(eq(dailyRhythmState.id, row.id));
        await db.db.insert(dailyRhythmState).values(record);
        return { id: row.id };
    }
    catch {
        return makeDegraded("state_unreadable", "dream", "Retry daily rhythm state write after DB recovery", validated.record);
    }
}
export async function readDailyRhythmStateByDay(db, day) {
    try {
        const rows = await db.db
            .select()
            .from(dailyRhythmState)
            .where(eq(dailyRhythmState.day, day))
            .orderBy(desc(dailyRhythmState.updatedAt))
            .limit(1);
        return { row: rows[0] };
    }
    catch {
        return {
            degraded: makeDegraded("state_unreadable", "dream", `Check state database connectivity for day=${day}`),
        };
    }
}
export async function readConnectorCooldownState(db, platformId, capabilityId) {
    try {
        const rows = await db.db
            .select()
            .from(connectorCooldownState)
            .where(and(eq(connectorCooldownState.platformId, platformId), eq(connectorCooldownState.capabilityId, capabilityId)))
            .orderBy(desc(connectorCooldownState.updatedAt))
            .limit(1);
        return { row: rows[0] };
    }
    catch {
        return {
            degraded: makeDegraded("state_unreadable", "ingestion", `Check state database connectivity for cooldown ${platformId}:${capabilityId}`),
        };
    }
}
export async function writeConnectorCooldownState(db, row) {
    const validated = validateSourceRefs(row.sourceRefs, "ingestion");
    if (!validated.ok)
        return validated.degraded;
    try {
        const record = {
            ...row,
            sourceRefsJson: serializeSourceRefs(validated.record),
        };
        await db.db.delete(connectorCooldownState).where(eq(connectorCooldownState.id, row.id));
        await db.db.insert(connectorCooldownState).values(record);
        return { id: row.id };
    }
    catch {
        return makeDegraded("state_unreadable", "ingestion", "Retry connector cooldown state write after DB recovery", validated.record);
    }
}
// ───────────────────────────────────────────────────────────────
// SourceRef round-trip helper (for tests and consumers)
// ───────────────────────────────────────────────────────────────
export function extractSourceRefs(row) {
    return parseSourceRefs(row.sourceRefsJson);
}
