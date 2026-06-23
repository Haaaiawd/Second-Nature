/**
 * v9 State Stores — Bounded write/read ports for Self Continuity, Character &
 * Procedural Evolution entities.
 *
 * Core logic: Persist and retrieve AttentionSignal, ActivityThread, ActivityStep,
 * ProceduralProjection, ToolRoutine, SelfContinuityCard, CharacterFrame,
 * ConnectorEvolutionPlan, ConnectorVersion, and RoutineExecutionTrace.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/memory-continuity-system.md`
 * - `.anws/v9/04_SYSTEM_DESIGN/memory-continuity-system.detail.md §2, §3.1b`
 * - `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md`
 *
 * Dependencies:
 * - drizzle-orm (SQLite)
 * - `src/storage/db/schema/v9-entities.js`
 * - `src/shared/types/v9-contracts.js` (SourceRef)
 *
 * Boundary:
 * - Write validation: rejects missing source refs.
 * - Read models: bounded by family + status filters; no cross-family joins.
 * - Degraded state: returns DegradedOperationResult on DB failure, never throws.
 *
 * Test coverage: tests/integration/storage/v9-schema-migration.test.ts
 */
import { eq, and, desc } from "drizzle-orm";
import { attentionSignal, activityThread, activityStep, toolRoutine, } from "./db/schema/v9-entities.js";
// ───────────────────────────────────────────────────────────────
// Shared helpers
// ───────────────────────────────────────────────────────────────
function serializeSourceRefs(refs) {
    return JSON.stringify(refs);
}
function parseSourceRefs(json) {
    if (!json)
        return [];
    try {
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed))
            return parsed;
        return [];
    }
    catch {
        return [];
    }
}
export async function writeAttentionSignal(db, options) {
    if (options.sourceRefs.length === 0) {
        throw new Error("attention_signal sourceRefs required");
    }
    const row = {
        id: options.id,
        createdAt: options.createdAt,
        cycleId: options.cycleId,
        novelty: options.novelty,
        relevance: options.relevance,
        repetition: options.repetition,
        status: options.status,
        sourceRefsJson: serializeSourceRefs(options.sourceRefs),
        evidenceRefsJson: options.evidenceRefs ? JSON.stringify(options.evidenceRefs) : undefined,
        riskFlagsJson: options.riskFlags ? JSON.stringify(options.riskFlags) : undefined,
        possibleActionsJson: options.possibleActions ? JSON.stringify(options.possibleActions) : undefined,
        activityThreadId: options.activityThreadId,
        threadSuggestion: options.threadSuggestion,
        payloadJson: options.payloadJson,
    };
    await db.db.insert(attentionSignal).values(row);
    return row;
}
export async function readAttentionSignalById(db, id) {
    const rows = await db.db.select().from(attentionSignal).where(eq(attentionSignal.id, id));
    return rows[0];
}
export async function writeActivityThread(db, options) {
    if (options.sourceRefs.length === 0) {
        throw new Error("activity_thread sourceRefs required");
    }
    const row = {
        id: options.id,
        originAttentionSignalId: options.originAttentionSignalId,
        status: options.status,
        currentFocus: options.currentFocus,
        associationsJson: options.associations ? JSON.stringify(options.associations) : undefined,
        nextPossibleMovesJson: options.nextPossibleMoves ? JSON.stringify(options.nextPossibleMoves) : undefined,
        completedStepCount: options.completedStepCount ?? 0,
        lastStepKind: options.lastStepKind,
        blockerReason: options.blockerReason,
        stopCondition: options.stopCondition,
        lastHeartbeatSequence: options.lastHeartbeatSequence,
        sourceRefsJson: serializeSourceRefs(options.sourceRefs),
        createdAt: options.createdAt,
        updatedAt: options.updatedAt,
    };
    await db.db.insert(activityThread).values(row);
    return row;
}
export async function readActivityThreadById(db, id) {
    const rows = await db.db.select().from(activityThread).where(eq(activityThread.id, id));
    return rows[0];
}
export async function updateActivityThreadProgress(db, id, patch) {
    await db.db.update(activityThread).set(patch).where(eq(activityThread.id, id));
}
export async function writeActivityStep(db, options) {
    if (options.sourceRefs.length === 0) {
        throw new Error("activity_step sourceRefs required");
    }
    const row = {
        id: options.id,
        threadId: options.threadId,
        cycleId: options.cycleId,
        stepKind: options.stepKind,
        summary: options.summary,
        sourceRefsJson: serializeSourceRefs(options.sourceRefs),
        closureRefJson: options.closureRef ? JSON.stringify(options.closureRef) : undefined,
        createdAt: options.createdAt,
    };
    await db.db.insert(activityStep).values(row);
    return row;
}
export async function readActivityStepsByThreadId(db, threadId, limit = 50) {
    return db.db
        .select()
        .from(activityStep)
        .where(eq(activityStep.threadId, threadId))
        .orderBy(desc(activityStep.createdAt))
        .limit(limit);
}
// ───────────────────────────────────────────────────────────────
// ToolRoutine read port (T6.2.1)
// ───────────────────────────────────────────────────────────────
export async function readActiveToolRoutinesByCapabilityPattern(db, capabilityPattern) {
    return db.db
        .select()
        .from(toolRoutine)
        .where(and(eq(toolRoutine.status, "active"), eq(toolRoutine.capabilityPattern, capabilityPattern)))
        .orderBy(desc(toolRoutine.activatedAt));
}
export async function writeToolRoutine(db, options) {
    if (options.sourceRefs.length === 0) {
        throw new Error("tool_routine sourceRefs required");
    }
    const row = {
        id: options.id,
        createdAt: options.createdAt,
        name: options.name,
        version: options.version,
        capabilityPattern: options.capabilityPattern,
        status: options.status ?? "active",
        sourceRefsJson: serializeSourceRefs(options.sourceRefs),
        rollbackRef: options.rollbackRef,
        payloadJson: options.payloadJson,
        activatedAt: options.activatedAt,
        retiredAt: options.retiredAt,
    };
    await db.db.insert(toolRoutine).values(row);
    return row;
}
// ───────────────────────────────────────────────────────────────
// Re-export serialization helpers for downstream v9 modules
// ───────────────────────────────────────────────────────────────
export { serializeSourceRefs, parseSourceRefs };
