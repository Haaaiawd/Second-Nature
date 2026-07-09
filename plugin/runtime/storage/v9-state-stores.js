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
import { eq, and, desc, asc } from "drizzle-orm";
import { attentionSignal, activityThread, activityStep, toolRoutine, routineExecutionTrace, proceduralProjection, connectorEvolutionPlan, connectorVersion, characterFrame, selfContinuityCard, autonomousChangeLedger, } from "./db/schema/v9-entities.js";
import { classifyDegradedStatus } from "../shared/degraded-status-classifier.js";
// ───────────────────────────────────────────────────────────────
// Shared helpers
// ───────────────────────────────────────────────────────────────
function makeDegraded(reason, ownerStage, operatorNextAction, sourceRefs = []) {
    return {
        status: classifyDegradedStatus(reason),
        reason,
        ownerStage,
        sourceRefs: sourceRefs,
        operatorNextAction,
        retryable: true,
    };
}
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
export async function readActivityThreadsByStatus(db, status, options = {}) {
    const order = options.orderBy === "asc" ? asc(activityThread.updatedAt) : desc(activityThread.updatedAt);
    const query = db.db.select().from(activityThread).where(eq(activityThread.status, status)).orderBy(order);
    if (options.limit !== undefined && options.limit > 0) {
        return await query.limit(options.limit);
    }
    return await query;
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
// ToolRoutine read/write ports (T6.2.1 affordance + T6.2.2 registry)
// ───────────────────────────────────────────────────────────────
export async function readActiveToolRoutinesByCapabilityPattern(db, capabilityPattern) {
    return db.db
        .select()
        .from(toolRoutine)
        .where(and(eq(toolRoutine.status, "active"), eq(toolRoutine.capabilityPattern, capabilityPattern)))
        .orderBy(desc(toolRoutine.activatedAt));
}
export async function readToolRoutinesByStatus(db, status) {
    try {
        const rows = await db.db
            .select()
            .from(toolRoutine)
            .where(eq(toolRoutine.status, status))
            .orderBy(desc(toolRoutine.createdAt));
        return { rows };
    }
    catch {
        return {
            rows: [],
            degraded: makeDegraded("state_unreadable", "projection", "Check state database connectivity"),
        };
    }
}
export async function readToolRoutineById(db, id) {
    const rows = await db.db.select().from(toolRoutine).where(eq(toolRoutine.id, id));
    return rows[0];
}
function buildToolRoutinePayloadJson(options) {
    const explicit = options.payloadJson ? safeParseJson(options.payloadJson) : {};
    const merged = { ...(explicit ?? {}) };
    if (options.triggerCapabilities !== undefined) {
        merged.triggerCapabilities = options.triggerCapabilities;
    }
    if (options.triggerConditionsJson !== undefined) {
        merged.triggerConditionsJson = options.triggerConditionsJson;
    }
    if (options.stepsJson !== undefined) {
        merged.stepsJson = options.stepsJson;
    }
    if (options.guardSchemaJson !== undefined) {
        merged.guardSchemaJson = options.guardSchemaJson;
    }
    if (Object.keys(merged).length === 0)
        return options.payloadJson;
    return JSON.stringify(merged);
}
function safeParseJson(s) {
    try {
        const v = JSON.parse(s);
        return v && typeof v === "object" && !Array.isArray(v) ? v : null;
    }
    catch {
        return null;
    }
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
        guardRefsJson: options.guardRefs ? JSON.stringify(options.guardRefs) : undefined,
        ledgerRef: options.ledgerRef,
        redactionClass: options.redactionClass ?? "none",
        payloadJson: buildToolRoutinePayloadJson(options),
        activatedAt: options.activatedAt,
        retiredAt: options.retiredAt,
    };
    await db.db.insert(toolRoutine).values(row);
    return row;
}
export async function updateToolRoutineStatus(db, id, status, patch) {
    try {
        const set = { status, ...patch };
        await db.db.update(toolRoutine).set(set).where(eq(toolRoutine.id, id));
        const rows = await db.db.select().from(toolRoutine).where(eq(toolRoutine.id, id));
        return rows[0];
    }
    catch {
        return undefined;
    }
}
export async function writeRoutineExecutionTrace(db, options) {
    if (options.sourceRefs.length === 0) {
        throw new Error("routine_execution_trace sourceRefs required");
    }
    const row = {
        id: options.id,
        createdAt: options.createdAt,
        routineId: options.routineId,
        cycleId: options.cycleId,
        status: options.status,
        sourceRefsJson: serializeSourceRefs(options.sourceRefs),
        proofRefsJson: options.proofRefs ? JSON.stringify(options.proofRefs) : undefined,
        traceRefsJson: options.traceRefs ? JSON.stringify(options.traceRefs) : undefined,
        payloadJson: options.payloadJson,
    };
    await db.db.insert(routineExecutionTrace).values(row);
    return row;
}
export async function readRoutineExecutionTracesByRoutine(db, routineId, limit = 50) {
    try {
        const rows = await db.db
            .select()
            .from(routineExecutionTrace)
            .where(eq(routineExecutionTrace.routineId, routineId))
            .orderBy(desc(routineExecutionTrace.createdAt))
            .limit(limit);
        return { rows };
    }
    catch {
        return {
            rows: [],
            degraded: makeDegraded("state_unreadable", "projection", "Check state database connectivity"),
        };
    }
}
export async function readRoutineExecutionTracesByCycle(db, cycleId, limit = 50) {
    try {
        const rows = await db.db
            .select()
            .from(routineExecutionTrace)
            .where(eq(routineExecutionTrace.cycleId, cycleId))
            .orderBy(desc(routineExecutionTrace.createdAt))
            .limit(limit);
        return { rows };
    }
    catch {
        return {
            rows: [],
            degraded: makeDegraded("state_unreadable", "projection", "Check state database connectivity"),
        };
    }
}
export async function writeProceduralProjection(db, options) {
    if (options.sourceRefs.length === 0) {
        throw new Error("procedural_projection sourceRefs required");
    }
    const row = {
        id: options.id,
        createdAt: options.createdAt,
        candidateId: options.candidateId,
        capabilityPattern: options.capabilityPattern,
        status: options.status ?? "candidate",
        sourceRefsJson: serializeSourceRefs(options.sourceRefs),
        payloadJson: options.payloadJson,
    };
    await db.db.insert(proceduralProjection).values(row);
    return row;
}
export async function readProceduralProjectionsByStatus(db, status) {
    try {
        const rows = await db.db
            .select()
            .from(proceduralProjection)
            .where(eq(proceduralProjection.status, status))
            .orderBy(desc(proceduralProjection.createdAt));
        return { rows };
    }
    catch {
        return {
            rows: [],
            degraded: makeDegraded("state_unreadable", "projection", "Check state database connectivity"),
        };
    }
}
export async function readProceduralProjectionsByCapabilityPattern(db, capabilityPattern) {
    try {
        const rows = await db.db
            .select()
            .from(proceduralProjection)
            .where(eq(proceduralProjection.capabilityPattern, capabilityPattern))
            .orderBy(desc(proceduralProjection.createdAt));
        return { rows };
    }
    catch {
        return {
            rows: [],
            degraded: makeDegraded("state_unreadable", "projection", "Check state database connectivity"),
        };
    }
}
export async function updateProceduralProjectionStatus(db, id, status, payloadJson) {
    try {
        await db.db
            .update(proceduralProjection)
            .set({ status, payloadJson })
            .where(eq(proceduralProjection.id, id));
        const rows = await db.db
            .select()
            .from(proceduralProjection)
            .where(eq(proceduralProjection.id, id));
        return rows[0];
    }
    catch {
        return undefined;
    }
}
export async function writeConnectorEvolutionPlan(db, options) {
    if (options.sourceRefs.length === 0) {
        throw new Error("connector_evolution_plan sourceRefs required");
    }
    const row = {
        id: options.id,
        createdAt: options.createdAt,
        platformId: options.platformId,
        planType: options.planType,
        status: options.status ?? "proposed",
        sourceRefsJson: serializeSourceRefs(options.sourceRefs),
        payloadJson: options.payloadJson,
        previousStableRef: options.previousStableRef,
        rollbackCommandHint: options.rollbackCommandHint,
    };
    await db.db.insert(connectorEvolutionPlan).values(row);
    return row;
}
export async function readConnectorEvolutionPlansByStatus(db, status) {
    try {
        const rows = await db.db
            .select()
            .from(connectorEvolutionPlan)
            .where(eq(connectorEvolutionPlan.status, status))
            .orderBy(desc(connectorEvolutionPlan.createdAt));
        return { rows };
    }
    catch {
        return {
            rows: [],
            degraded: makeDegraded("state_unreadable", "projection", "Check state database connectivity"),
        };
    }
}
export async function readConnectorEvolutionPlansByPlatform(db, platformId) {
    try {
        const rows = await db.db
            .select()
            .from(connectorEvolutionPlan)
            .where(eq(connectorEvolutionPlan.platformId, platformId))
            .orderBy(desc(connectorEvolutionPlan.createdAt));
        return { rows };
    }
    catch {
        return {
            rows: [],
            degraded: makeDegraded("state_unreadable", "projection", "Check state database connectivity"),
        };
    }
}
export async function updateConnectorEvolutionPlanStatus(db, id, status, payloadJson) {
    try {
        await db.db
            .update(connectorEvolutionPlan)
            .set({ status, payloadJson })
            .where(eq(connectorEvolutionPlan.id, id));
        const rows = await db.db
            .select()
            .from(connectorEvolutionPlan)
            .where(eq(connectorEvolutionPlan.id, id));
        return rows[0];
    }
    catch {
        return undefined;
    }
}
export async function writeConnectorVersion(db, options) {
    if (options.sourceRefs.length === 0) {
        throw new Error("connector_version sourceRefs required");
    }
    const assetPaths = {};
    if (options.manifestPath)
        assetPaths.manifestPath = options.manifestPath;
    if (options.recipePath)
        assetPaths.recipePath = options.recipePath;
    if (options.adapterPath)
        assetPaths.adapterPath = options.adapterPath;
    const payload = {};
    if (options.workspaceRoot)
        payload.workspaceRoot = options.workspaceRoot;
    if (options.planType)
        payload.planType = options.planType;
    if (options.gateResults)
        payload.gateResults = options.gateResults;
    const row = {
        id: options.id,
        createdAt: options.createdAt,
        platformId: options.platformId,
        versionId: options.versionId,
        sequence: options.sequence,
        assetPathsJson: Object.keys(assetPaths).length > 0 ? JSON.stringify(assetPaths) : null,
        declaredCapabilitiesJson: options.declaredCapabilities
            ? JSON.stringify(options.declaredCapabilities)
            : null,
        status: options.status ?? "candidate",
        previousStableRef: options.previousStableRef,
        rollbackRef: options.rollbackRef,
        rollbackCommandHint: options.rollbackCommandHint,
        sourceRefsJson: serializeSourceRefs(options.sourceRefs),
        payloadJson: Object.keys(payload).length > 0 ? JSON.stringify(payload) : null,
        activatedAt: options.activatedAt,
        rolledBackAt: options.rolledBackAt,
    };
    const upsertRow = { ...row };
    delete upsertRow.id;
    await db.db
        .insert(connectorVersion)
        .values(row)
        .onConflictDoUpdate({
        target: connectorVersion.id,
        set: upsertRow,
    });
    return row;
}
export async function readConnectorVersionById(db, versionId) {
    try {
        const rows = await db.db
            .select()
            .from(connectorVersion)
            .where(eq(connectorVersion.versionId, versionId));
        return rows[0];
    }
    catch {
        return undefined;
    }
}
export async function readActiveConnectorVersion(db, platformId) {
    try {
        const rows = await db.db
            .select()
            .from(connectorVersion)
            .where(and(eq(connectorVersion.platformId, platformId), eq(connectorVersion.status, "active")))
            .orderBy(desc(connectorVersion.createdAt));
        return rows[0];
    }
    catch {
        return undefined;
    }
}
export async function updateConnectorVersionStatus(db, versionId, status, patch) {
    try {
        const updateSet = { status };
        if (patch?.rollbackRef !== undefined)
            updateSet.rollbackRef = patch.rollbackRef;
        if (patch?.rollbackCommandHint !== undefined)
            updateSet.rollbackCommandHint = patch.rollbackCommandHint;
        if (patch?.activatedAt !== undefined)
            updateSet.activatedAt = patch.activatedAt;
        if (patch?.rolledBackAt !== undefined)
            updateSet.rolledBackAt = patch.rolledBackAt;
        await db.db
            .update(connectorVersion)
            .set(updateSet)
            .where(eq(connectorVersion.versionId, versionId));
        const rows = await db.db
            .select()
            .from(connectorVersion)
            .where(eq(connectorVersion.versionId, versionId));
        return rows[0];
    }
    catch {
        return undefined;
    }
}
export async function writeCharacterFrame(db, options) {
    if (options.sourceRefs.length === 0) {
        throw new Error("character_frame sourceRefs required");
    }
    const row = {
        id: options.id,
        createdAt: options.createdAt,
        version: options.version,
        validFrom: options.validFrom,
        sectionsJson: options.sectionsJson,
        contestPrompt: options.contestPrompt,
        charCount: options.charCount,
        sourceRefsJson: serializeSourceRefs(options.sourceRefs),
        status: options.status ?? "candidate",
        supersededBy: options.supersededBy,
        revisionOf: options.revisionOf,
        acceptedAt: options.acceptedAt,
        validUntil: options.validUntil,
        payloadJson: options.payloadJson,
    };
    await db.db.insert(characterFrame).values(row);
    return row;
}
export async function readCharacterFrameById(db, id) {
    const rows = await db.db.select().from(characterFrame).where(eq(characterFrame.id, id));
    return rows[0];
}
export async function readCharacterFramesByStatus(db, status) {
    try {
        const rows = await db.db
            .select()
            .from(characterFrame)
            .where(eq(characterFrame.status, status))
            .orderBy(desc(characterFrame.createdAt));
        return { rows };
    }
    catch {
        return {
            rows: [],
            degraded: makeDegraded("state_unreadable", "projection", "Check state database connectivity"),
        };
    }
}
export async function readLatestAcceptedCharacterFrame(db) {
    try {
        const rows = await db.db
            .select()
            .from(characterFrame)
            .where(eq(characterFrame.status, "accepted"))
            .orderBy(desc(characterFrame.acceptedAt))
            .limit(1);
        return { row: rows[0] };
    }
    catch {
        return {
            degraded: makeDegraded("state_unreadable", "projection", "Check state database connectivity"),
        };
    }
}
export async function readCharacterFrameRevisionCandidates(db, revisionOf) {
    try {
        const rows = await db.db
            .select()
            .from(characterFrame)
            .where(and(eq(characterFrame.status, "candidate"), eq(characterFrame.revisionOf, revisionOf)))
            .orderBy(desc(characterFrame.createdAt));
        return { rows };
    }
    catch {
        return {
            rows: [],
            degraded: makeDegraded("state_unreadable", "projection", "Check state database connectivity"),
        };
    }
}
export async function updateCharacterFrameStatus(db, id, status, patch) {
    try {
        const set = { status, ...patch };
        await db.db.update(characterFrame).set(set).where(eq(characterFrame.id, id));
        const rows = await db.db.select().from(characterFrame).where(eq(characterFrame.id, id));
        return rows[0];
    }
    catch {
        return undefined;
    }
}
export async function writeSelfContinuityCard(db, options) {
    if (options.sourceRefs.length === 0) {
        throw new Error("self_continuity_card sourceRefs required");
    }
    if (new TextEncoder().encode(options.cardText).length > 4000) {
        throw new Error("self_continuity_card cardText exceeds hard byte ceiling");
    }
    try {
        const row = {
            id: options.id,
            createdAt: options.createdAt,
            version: options.version ?? 1,
            cardText: options.cardText,
            sectionsJson: options.sectionsJson,
            sourceRefsJson: serializeSourceRefs(options.sourceRefs),
            characterFramePointerJson: options.characterFramePointerJson,
            status: options.status ?? "active",
            redactionClass: options.redactionClass ?? "none",
            payloadJson: options.payloadJson,
        };
        await db.db.insert(selfContinuityCard).values(row);
        return row;
    }
    catch {
        return undefined;
    }
}
export async function readLatestSelfContinuityCard(db) {
    try {
        const rows = await db.db
            .select()
            .from(selfContinuityCard)
            .orderBy(desc(selfContinuityCard.createdAt))
            .limit(1);
        return { row: rows[0] };
    }
    catch {
        return {
            degraded: makeDegraded("state_unreadable", "projection", "Check state database connectivity"),
        };
    }
}
export async function readSelfContinuityCardById(db, id) {
    try {
        const rows = await db.db.select().from(selfContinuityCard).where(eq(selfContinuityCard.id, id));
        return { row: rows[0] };
    }
    catch {
        return {
            degraded: makeDegraded("state_unreadable", "projection", "Check state database connectivity"),
        };
    }
}
export async function updateSelfContinuityCardStatus(db, id, status) {
    try {
        await db.db.update(selfContinuityCard).set({ status }).where(eq(selfContinuityCard.id, id));
        const rows = await db.db.select().from(selfContinuityCard).where(eq(selfContinuityCard.id, id));
        return rows[0];
    }
    catch {
        return undefined;
    }
}
export async function writeAutonomousChangeLedger(db, options) {
    if (options.sourceRefs.length === 0) {
        throw new Error("autonomous_change_ledger sourceRefs required");
    }
    const row = {
        id: options.id,
        createdAt: options.createdAt,
        workspaceRoot: options.workspaceRoot,
        changeKind: options.changeKind,
        targetId: options.targetId,
        previousStableRef: options.previousStableRef,
        status: options.status ?? "proposed",
        gateResultsJson: options.gateResultsJson,
        rollbackRef: options.rollbackRef,
        rollbackCommandHint: options.rollbackCommandHint,
        sourceRefsJson: serializeSourceRefs(options.sourceRefs),
        redactedPayloadJson: options.redactedPayloadJson,
        activatedAt: options.activatedAt,
        rolledBackAt: options.rolledBackAt,
    };
    await db.db.insert(autonomousChangeLedger).values(row);
    return row;
}
export async function readAutonomousChangeLedgerById(db, id) {
    const rows = await db.db.select().from(autonomousChangeLedger).where(eq(autonomousChangeLedger.id, id));
    return rows[0];
}
export async function readAutonomousChangeLedgerByTarget(db, targetId, limit = 50) {
    try {
        const rows = await db.db
            .select()
            .from(autonomousChangeLedger)
            .where(eq(autonomousChangeLedger.targetId, targetId))
            .orderBy(desc(autonomousChangeLedger.createdAt))
            .limit(limit);
        return { rows };
    }
    catch {
        return {
            rows: [],
            degraded: makeDegraded("state_unreadable", "projection", "Check state database connectivity"),
        };
    }
}
export async function readAutonomousChangeLedgerByStatus(db, status) {
    try {
        const rows = await db.db
            .select()
            .from(autonomousChangeLedger)
            .where(eq(autonomousChangeLedger.status, status))
            .orderBy(desc(autonomousChangeLedger.createdAt));
        return { rows };
    }
    catch {
        return {
            rows: [],
            degraded: makeDegraded("state_unreadable", "projection", "Check state database connectivity"),
        };
    }
}
export async function updateAutonomousChangeLedgerStatus(db, id, status, patch) {
    try {
        const set = { status, ...patch };
        await db.db.update(autonomousChangeLedger).set(set).where(eq(autonomousChangeLedger.id, id));
        const rows = await db.db.select().from(autonomousChangeLedger).where(eq(autonomousChangeLedger.id, id));
        return rows[0];
    }
    catch {
        return undefined;
    }
}
// ───────────────────────────────────────────────────────────────
// Re-export serialization helpers for downstream v9 modules
// ───────────────────────────────────────────────────────────────
export { serializeSourceRefs, parseSourceRefs };
