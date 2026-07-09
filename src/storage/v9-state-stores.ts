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
import type { StateDatabase } from "./db/index.js";
import {
  attentionSignal,
  activityThread,
  activityStep,
  toolRoutine,
  routineExecutionTrace,
  proceduralProjection,
  connectorEvolutionPlan,
  connectorVersion,
  characterFrame,
  selfContinuityCard,
  autonomousChangeLedger,
  type AttentionSignalRecord,
  type NewAttentionSignalRecord,
  type ActivityThreadRecord,
  type NewActivityThreadRecord,
  type ActivityStepRecord,
  type NewActivityStepRecord,
  type ToolRoutineRecord,
  type NewToolRoutineRecord,
  type RoutineExecutionTraceRecord,
  type NewRoutineExecutionTraceRecord,
  type ProceduralProjectionRecord,
  type NewProceduralProjectionRecord,
  type ConnectorEvolutionPlanRecord,
  type NewConnectorEvolutionPlanRecord,
  type ConnectorVersionRecord,
  type NewConnectorVersionRecord,
  type CharacterFrameRecord,
  type NewCharacterFrameRecord,
  type SelfContinuityCardRecord,
  type NewSelfContinuityCardRecord,
  type AutonomousChangeLedgerRecord,
  type NewAutonomousChangeLedgerRecord,
} from "./db/schema/v9-entities.js";
import type {
  SourceRef,
  ConnectorVersionStatus,
  ConnectorPlanType,
  GateResult,
} from "../shared/types/v9-contracts.js";
import type { DegradedOperationResult } from "../shared/types/v8-contracts.js";
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
    sourceRefs: sourceRefs as unknown as import("../shared/types/v8-contracts.js").SourceRef[],
    operatorNextAction,
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

// ───────────────────────────────────────────────────────────────
// AttentionSignal
// ───────────────────────────────────────────────────────────────

export interface WriteAttentionSignalOptions {
  id: string;
  createdAt: string;
  cycleId: string;
  novelty: number;
  relevance: number;
  repetition: AttentionSignalRecord["repetition"];
  status: AttentionSignalRecord["status"];
  sourceRefs: SourceRef[];
  evidenceRefs?: string[];
  riskFlags?: string[];
  possibleActions?: string[];
  activityThreadId?: string;
  threadSuggestion?: AttentionSignalRecord["threadSuggestion"];
  payloadJson?: string;
}

export async function writeAttentionSignal(
  db: StateDatabase,
  options: WriteAttentionSignalOptions,
): Promise<AttentionSignalRecord> {
  if (options.sourceRefs.length === 0) {
    throw new Error("attention_signal sourceRefs required");
  }
  const row: NewAttentionSignalRecord = {
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
  return row as AttentionSignalRecord;
}

export async function readAttentionSignalById(
  db: StateDatabase,
  id: string,
): Promise<AttentionSignalRecord | undefined> {
  const rows = await db.db.select().from(attentionSignal).where(eq(attentionSignal.id, id));
  return rows[0];
}

// ───────────────────────────────────────────────────────────────
// ActivityThread
// ───────────────────────────────────────────────────────────────

export interface WriteActivityThreadOptions {
  id: string;
  originAttentionSignalId: string;
  status: ActivityThreadRecord["status"];
  currentFocus: string;
  associations?: string[];
  nextPossibleMoves?: string[];
  completedStepCount?: number;
  lastStepKind?: ActivityThreadRecord["lastStepKind"];
  blockerReason?: string;
  stopCondition: ActivityThreadRecord["stopCondition"];
  lastHeartbeatSequence: number;
  sourceRefs: SourceRef[];
  createdAt: string;
  updatedAt: string;
}

export async function writeActivityThread(
  db: StateDatabase,
  options: WriteActivityThreadOptions,
): Promise<ActivityThreadRecord> {
  if (options.sourceRefs.length === 0) {
    throw new Error("activity_thread sourceRefs required");
  }
  const row: NewActivityThreadRecord = {
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
  return row as ActivityThreadRecord;
}

export async function readActivityThreadById(
  db: StateDatabase,
  id: string,
): Promise<ActivityThreadRecord | undefined> {
  const rows = await db.db.select().from(activityThread).where(eq(activityThread.id, id));
  return rows[0];
}

export async function readActivityThreadsByStatus(
  db: StateDatabase,
  status: ActivityThreadRecord["status"],
  options: { limit?: number; orderBy?: "asc" | "desc" } = {},
): Promise<ActivityThreadRecord[]> {
  const order = options.orderBy === "asc" ? asc(activityThread.updatedAt) : desc(activityThread.updatedAt);
  const query = db.db.select().from(activityThread).where(eq(activityThread.status, status)).orderBy(order);
  if (options.limit !== undefined && options.limit > 0) {
    return await query.limit(options.limit);
  }
  return await query;
}

export async function updateActivityThreadProgress(
  db: StateDatabase,
  id: string,
  patch: Partial<Pick<
    ActivityThreadRecord,
    | "status"
    | "currentFocus"
    | "completedStepCount"
    | "lastStepKind"
    | "blockerReason"
    | "stopCondition"
    | "nextPossibleMovesJson"
    | "lastHeartbeatSequence"
    | "updatedAt"
  >>,
): Promise<void> {
  await db.db.update(activityThread).set(patch).where(eq(activityThread.id, id));
}

// ───────────────────────────────────────────────────────────────
// ActivityStep
// ───────────────────────────────────────────────────────────────

export interface WriteActivityStepOptions {
  id: string;
  threadId: string;
  cycleId: string;
  stepKind: ActivityStepRecord["stepKind"];
  summary: string;
  sourceRefs: SourceRef[];
  closureRef?: SourceRef;
  createdAt: string;
}

export async function writeActivityStep(
  db: StateDatabase,
  options: WriteActivityStepOptions,
): Promise<ActivityStepRecord> {
  if (options.sourceRefs.length === 0) {
    throw new Error("activity_step sourceRefs required");
  }
  const row: NewActivityStepRecord = {
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
  return row as ActivityStepRecord;
}

export async function readActivityStepsByThreadId(
  db: StateDatabase,
  threadId: string,
  limit = 50,
): Promise<ActivityStepRecord[]> {
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

export async function readActiveToolRoutinesByCapabilityPattern(
  db: StateDatabase,
  capabilityPattern: string,
): Promise<ToolRoutineRecord[]> {
  return db.db
    .select()
    .from(toolRoutine)
    .where(
      and(
        eq(toolRoutine.status, "active"),
        eq(toolRoutine.capabilityPattern, capabilityPattern),
      ),
    )
    .orderBy(desc(toolRoutine.activatedAt));
}

export async function readToolRoutinesByStatus(
  db: StateDatabase,
  status: ToolRoutineRecord["status"],
): Promise<{ rows: ToolRoutineRecord[]; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(toolRoutine)
      .where(eq(toolRoutine.status, status))
      .orderBy(desc(toolRoutine.createdAt));
    return { rows };
  } catch {
    return {
      rows: [],
      degraded: makeDegraded("state_unreadable", "projection", "Check state database connectivity"),
    };
  }
}

export async function readToolRoutineById(
  db: StateDatabase,
  id: string,
): Promise<ToolRoutineRecord | undefined> {
  const rows = await db.db.select().from(toolRoutine).where(eq(toolRoutine.id, id));
  return rows[0];
}

export interface WriteToolRoutineOptions {
  id: string;
  name: string;
  version: string;
  capabilityPattern: string;
  status?: ToolRoutineRecord["status"];
  sourceRefs: SourceRef[];
  rollbackRef?: string;
  // T6.2.2: guard evidence refs + ledger linkage + redaction class
  guardRefs?: SourceRef[];
  ledgerRef?: string;
  redactionClass?: ToolRoutineRecord["redactionClass"];
  // T6.2.2: routine body fields persisted into payloadJson as a single object.
  // When provided, these are merged into payloadJson alongside any explicit payloadJson.
  triggerCapabilities?: string[];
  triggerConditionsJson?: string;
  stepsJson?: string;
  guardSchemaJson?: string;
  payloadJson?: string;
  activatedAt?: string;
  retiredAt?: string;
  createdAt: string;
}

function buildToolRoutinePayloadJson(options: WriteToolRoutineOptions): string | undefined {
  const explicit = options.payloadJson ? safeParseJson(options.payloadJson) : {};
  const merged: Record<string, unknown> = { ...(explicit ?? {}) };
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
  if (Object.keys(merged).length === 0) return options.payloadJson;
  return JSON.stringify(merged);
}

function safeParseJson(s: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function writeToolRoutine(
  db: StateDatabase,
  options: WriteToolRoutineOptions,
): Promise<ToolRoutineRecord> {
  if (options.sourceRefs.length === 0) {
    throw new Error("tool_routine sourceRefs required");
  }
  const row: NewToolRoutineRecord = {
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
  return row as ToolRoutineRecord;
}

export async function updateToolRoutineStatus(
  db: StateDatabase,
  id: string,
  status: ToolRoutineRecord["status"],
  patch?: Partial<
    Pick<ToolRoutineRecord, "activatedAt" | "retiredAt" | "ledgerRef" | "payloadJson">
  >,
): Promise<ToolRoutineRecord | undefined> {
  try {
    const set: Partial<ToolRoutineRecord> = { status, ...patch };
    await db.db.update(toolRoutine).set(set).where(eq(toolRoutine.id, id));
    const rows = await db.db.select().from(toolRoutine).where(eq(toolRoutine.id, id));
    return rows[0];
  } catch {
    return undefined;
  }
}

// ───────────────────────────────────────────────────────────────
// RoutineExecutionTrace read/write ports (T6.2.2)
// ───────────────────────────────────────────────────────────────

export interface WriteRoutineExecutionTraceOptions {
  id: string;
  routineId: string;
  cycleId: string;
  status: RoutineExecutionTraceRecord["status"];
  sourceRefs: SourceRef[];
  proofRefs?: SourceRef[];
  traceRefs?: SourceRef[];
  payloadJson?: string;
  createdAt: string;
}

export async function writeRoutineExecutionTrace(
  db: StateDatabase,
  options: WriteRoutineExecutionTraceOptions,
): Promise<RoutineExecutionTraceRecord> {
  if (options.sourceRefs.length === 0) {
    throw new Error("routine_execution_trace sourceRefs required");
  }
  const row: NewRoutineExecutionTraceRecord = {
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
  return row as RoutineExecutionTraceRecord;
}

export async function readRoutineExecutionTracesByRoutine(
  db: StateDatabase,
  routineId: string,
  limit = 50,
): Promise<{ rows: RoutineExecutionTraceRecord[]; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(routineExecutionTrace)
      .where(eq(routineExecutionTrace.routineId, routineId))
      .orderBy(desc(routineExecutionTrace.createdAt))
      .limit(limit);
    return { rows };
  } catch {
    return {
      rows: [],
      degraded: makeDegraded("state_unreadable", "projection", "Check state database connectivity"),
    };
  }
}

export async function readRoutineExecutionTracesByCycle(
  db: StateDatabase,
  cycleId: string,
  limit = 50,
): Promise<{ rows: RoutineExecutionTraceRecord[]; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(routineExecutionTrace)
      .where(eq(routineExecutionTrace.cycleId, cycleId))
      .orderBy(desc(routineExecutionTrace.createdAt))
      .limit(limit);
    return { rows };
  } catch {
    return {
      rows: [],
      degraded: makeDegraded("state_unreadable", "projection", "Check state database connectivity"),
    };
  }
}

// ───────────────────────────────────────────────────────────────
// ProceduralProjection read/write ports (T5.2.1)
// ───────────────────────────────────────────────────────────────

export interface WriteProceduralProjectionOptions {
  id: string;
  createdAt: string;
  candidateId: string;
  capabilityPattern: string;
  status?: ProceduralProjectionRecord["status"];
  sourceRefs: SourceRef[];
  payloadJson?: string;
}

export async function writeProceduralProjection(
  db: StateDatabase,
  options: WriteProceduralProjectionOptions,
): Promise<ProceduralProjectionRecord> {
  if (options.sourceRefs.length === 0) {
    throw new Error("procedural_projection sourceRefs required");
  }
  const row: NewProceduralProjectionRecord = {
    id: options.id,
    createdAt: options.createdAt,
    candidateId: options.candidateId,
    capabilityPattern: options.capabilityPattern,
    status: options.status ?? "candidate",
    sourceRefsJson: serializeSourceRefs(options.sourceRefs),
    payloadJson: options.payloadJson,
  };
  await db.db.insert(proceduralProjection).values(row);
  return row as ProceduralProjectionRecord;
}

export async function readProceduralProjectionsByStatus(
  db: StateDatabase,
  status: ProceduralProjectionRecord["status"],
): Promise<{ rows: ProceduralProjectionRecord[]; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(proceduralProjection)
      .where(eq(proceduralProjection.status, status))
      .orderBy(desc(proceduralProjection.createdAt));
    return { rows };
  } catch {
    return {
      rows: [],
      degraded: makeDegraded("state_unreadable", "projection", "Check state database connectivity"),
    };
  }
}

export async function readProceduralProjectionsByCapabilityPattern(
  db: StateDatabase,
  capabilityPattern: string,
): Promise<{ rows: ProceduralProjectionRecord[]; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(proceduralProjection)
      .where(eq(proceduralProjection.capabilityPattern, capabilityPattern))
      .orderBy(desc(proceduralProjection.createdAt));
    return { rows };
  } catch {
    return {
      rows: [],
      degraded: makeDegraded("state_unreadable", "projection", "Check state database connectivity"),
    };
  }
}

export async function updateProceduralProjectionStatus(
  db: StateDatabase,
  id: string,
  status: ProceduralProjectionRecord["status"],
  payloadJson?: string,
): Promise<ProceduralProjectionRecord | undefined> {
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
  } catch {
    return undefined;
  }
}

// ───────────────────────────────────────────────────────────────
// ConnectorEvolutionPlan read/write ports (T5.2.1)
// ───────────────────────────────────────────────────────────────

export interface WriteConnectorEvolutionPlanOptions {
  id: string;
  createdAt: string;
  platformId: string;
  planType: ConnectorEvolutionPlanRecord["planType"];
  status?: ConnectorEvolutionPlanRecord["status"];
  sourceRefs: SourceRef[];
  payloadJson?: string;
  previousStableRef?: string;
  rollbackCommandHint?: string;
}

export async function writeConnectorEvolutionPlan(
  db: StateDatabase,
  options: WriteConnectorEvolutionPlanOptions,
): Promise<ConnectorEvolutionPlanRecord> {
  if (options.sourceRefs.length === 0) {
    throw new Error("connector_evolution_plan sourceRefs required");
  }
  const row: NewConnectorEvolutionPlanRecord = {
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
  return row as ConnectorEvolutionPlanRecord;
}

export async function readConnectorEvolutionPlansByStatus(
  db: StateDatabase,
  status: ConnectorEvolutionPlanRecord["status"],
): Promise<{ rows: ConnectorEvolutionPlanRecord[]; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(connectorEvolutionPlan)
      .where(eq(connectorEvolutionPlan.status, status))
      .orderBy(desc(connectorEvolutionPlan.createdAt));
    return { rows };
  } catch {
    return {
      rows: [],
      degraded: makeDegraded("state_unreadable", "projection", "Check state database connectivity"),
    };
  }
}

export async function readConnectorEvolutionPlansByPlatform(
  db: StateDatabase,
  platformId: string,
): Promise<{ rows: ConnectorEvolutionPlanRecord[]; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(connectorEvolutionPlan)
      .where(eq(connectorEvolutionPlan.platformId, platformId))
      .orderBy(desc(connectorEvolutionPlan.createdAt));
    return { rows };
  } catch {
    return {
      rows: [],
      degraded: makeDegraded("state_unreadable", "projection", "Check state database connectivity"),
    };
  }
}

export async function updateConnectorEvolutionPlanStatus(
  db: StateDatabase,
  id: string,
  status: ConnectorEvolutionPlanRecord["status"],
  payloadJson?: string,
): Promise<ConnectorEvolutionPlanRecord | undefined> {
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
  } catch {
    return undefined;
  }
}

// ───────────────────────────────────────────────────────────────
// ConnectorVersion (T6.3.1)
// ───────────────────────────────────────────────────────────────

export interface WriteConnectorVersionOptions {
  id: string;
  createdAt: string;
  platformId: string;
  versionId: string;
  sequence?: number;
  /** { manifestPath, recipePath?, adapterPath? } serialized into assetPathsJson. */
  manifestPath?: string;
  recipePath?: string;
  adapterPath?: string;
  declaredCapabilities?: string[];
  status?: ConnectorVersionStatus;
  previousStableRef?: string;
  rollbackRef?: string;
  rollbackCommandHint?: string;
  sourceRefs: SourceRef[];
  /** Additional payload (gateResults, workspaceRoot, planType) stored in payloadJson. */
  workspaceRoot?: string;
  planType?: ConnectorPlanType;
  gateResults?: GateResult[];
  activatedAt?: string;
  rolledBackAt?: string;
}

export async function writeConnectorVersion(
  db: StateDatabase,
  options: WriteConnectorVersionOptions,
): Promise<ConnectorVersionRecord> {
  if (options.sourceRefs.length === 0) {
    throw new Error("connector_version sourceRefs required");
  }
  const assetPaths: Record<string, string> = {};
  if (options.manifestPath) assetPaths.manifestPath = options.manifestPath;
  if (options.recipePath) assetPaths.recipePath = options.recipePath;
  if (options.adapterPath) assetPaths.adapterPath = options.adapterPath;
  const payload: Record<string, unknown> = {};
  if (options.workspaceRoot) payload.workspaceRoot = options.workspaceRoot;
  if (options.planType) payload.planType = options.planType;
  if (options.gateResults) payload.gateResults = options.gateResults;
  const row: NewConnectorVersionRecord = {
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
  delete (upsertRow as { id?: string }).id;
  await db.db
    .insert(connectorVersion)
    .values(row)
    .onConflictDoUpdate({
      target: connectorVersion.id,
      set: upsertRow,
    });
  return row as ConnectorVersionRecord;
}

export async function readConnectorVersionById(
  db: StateDatabase,
  versionId: string,
): Promise<ConnectorVersionRecord | undefined> {
  try {
    const rows = await db.db
      .select()
      .from(connectorVersion)
      .where(eq(connectorVersion.versionId, versionId));
    return rows[0];
  } catch {
    return undefined;
  }
}

export async function readActiveConnectorVersion(
  db: StateDatabase,
  platformId: string,
): Promise<ConnectorVersionRecord | undefined> {
  try {
    const rows = await db.db
      .select()
      .from(connectorVersion)
      .where(
        and(
          eq(connectorVersion.platformId, platformId),
          eq(connectorVersion.status, "active"),
        ),
      )
      .orderBy(desc(connectorVersion.createdAt));
    return rows[0];
  } catch {
    return undefined;
  }
}

export async function updateConnectorVersionStatus(
  db: StateDatabase,
  versionId: string,
  status: ConnectorVersionStatus,
  patch?: Partial<{
    rollbackRef: string;
    rollbackCommandHint: string;
    activatedAt: string;
    rolledBackAt: string;
  }>,
): Promise<ConnectorVersionRecord | undefined> {
  try {
    const updateSet: Record<string, unknown> = { status };
    if (patch?.rollbackRef !== undefined) updateSet.rollbackRef = patch.rollbackRef;
    if (patch?.rollbackCommandHint !== undefined)
      updateSet.rollbackCommandHint = patch.rollbackCommandHint;
    if (patch?.activatedAt !== undefined) updateSet.activatedAt = patch.activatedAt;
    if (patch?.rolledBackAt !== undefined) updateSet.rolledBackAt = patch.rolledBackAt;
    await db.db
      .update(connectorVersion)
      .set(updateSet)
      .where(eq(connectorVersion.versionId, versionId));
    const rows = await db.db
      .select()
      .from(connectorVersion)
      .where(eq(connectorVersion.versionId, versionId));
    return rows[0];
  } catch {
    return undefined;
  }
}

// ───────────────────────────────────────────────────────────────
// CharacterFrame (T7.2.1)
// ───────────────────────────────────────────────────────────────

export interface WriteCharacterFrameOptions {
  id: string;
  createdAt: string;
  version: number;
  validFrom: string;
  status?: CharacterFrameRecord["status"];
  sectionsJson: string;
  contestPrompt: string;
  charCount: number;
  sourceRefs: SourceRef[];
  supersededBy?: string | null;
  revisionOf?: string | null;
  acceptedAt?: string | null;
  validUntil?: string | null;
  payloadJson?: string;
}

export async function writeCharacterFrame(
  db: StateDatabase,
  options: WriteCharacterFrameOptions,
): Promise<CharacterFrameRecord> {
  if (options.sourceRefs.length === 0) {
    throw new Error("character_frame sourceRefs required");
  }
  const row: NewCharacterFrameRecord = {
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
  return row as CharacterFrameRecord;
}

export async function readCharacterFrameById(
  db: StateDatabase,
  id: string,
): Promise<CharacterFrameRecord | undefined> {
  const rows = await db.db.select().from(characterFrame).where(eq(characterFrame.id, id));
  return rows[0];
}

export async function readCharacterFramesByStatus(
  db: StateDatabase,
  status: CharacterFrameRecord["status"],
): Promise<{ rows: CharacterFrameRecord[]; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(characterFrame)
      .where(eq(characterFrame.status, status))
      .orderBy(desc(characterFrame.createdAt));
    return { rows };
  } catch {
    return {
      rows: [],
      degraded: makeDegraded("state_unreadable", "projection", "Check state database connectivity"),
    };
  }
}

export async function readLatestAcceptedCharacterFrame(
  db: StateDatabase,
): Promise<{ row?: CharacterFrameRecord; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(characterFrame)
      .where(eq(characterFrame.status, "accepted"))
      .orderBy(desc(characterFrame.acceptedAt))
      .limit(1);
    return { row: rows[0] };
  } catch {
    return {
      degraded: makeDegraded("state_unreadable", "projection", "Check state database connectivity"),
    };
  }
}

export async function readCharacterFrameRevisionCandidates(
  db: StateDatabase,
  revisionOf: string,
): Promise<{ rows: CharacterFrameRecord[]; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(characterFrame)
      .where(and(eq(characterFrame.status, "candidate"), eq(characterFrame.revisionOf, revisionOf)))
      .orderBy(desc(characterFrame.createdAt));
    return { rows };
  } catch {
    return {
      rows: [],
      degraded: makeDegraded("state_unreadable", "projection", "Check state database connectivity"),
    };
  }
}

export async function updateCharacterFrameStatus(
  db: StateDatabase,
  id: string,
  status: CharacterFrameRecord["status"],
  patch?: Partial<
    Pick<
      CharacterFrameRecord,
      | "supersededBy"
      | "revisionOf"
      | "acceptedAt"
      | "validFrom"
      | "validUntil"
      | "charCount"
      | "payloadJson"
    >
  >,
): Promise<CharacterFrameRecord | undefined> {
  try {
    const set: Partial<CharacterFrameRecord> = { status, ...patch };
    await db.db.update(characterFrame).set(set).where(eq(characterFrame.id, id));
    const rows = await db.db.select().from(characterFrame).where(eq(characterFrame.id, id));
    return rows[0];
  } catch {
    return undefined;
  }
}

// ───────────────────────────────────────────────────────────────
// SelfContinuityCard (T5.2.2)
// ───────────────────────────────────────────────────────────────

export interface WriteSelfContinuityCardOptions {
  id: string;
  createdAt: string;
  version?: number;
  cardText: string;
  sectionsJson: string;
  sourceRefs: SourceRef[];
  characterFramePointerJson: string;
  status?: SelfContinuityCardRecord["status"];
  redactionClass?: SelfContinuityCardRecord["redactionClass"];
  payloadJson?: string;
}

export async function writeSelfContinuityCard(
  db: StateDatabase,
  options: WriteSelfContinuityCardOptions,
): Promise<SelfContinuityCardRecord | undefined> {
  if (options.sourceRefs.length === 0) {
    throw new Error("self_continuity_card sourceRefs required");
  }
  if (new TextEncoder().encode(options.cardText).length > 4000) {
    throw new Error("self_continuity_card cardText exceeds hard byte ceiling");
  }
  try {
    const row: NewSelfContinuityCardRecord = {
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
    return row as SelfContinuityCardRecord;
  } catch {
    return undefined;
  }
}

export async function readLatestSelfContinuityCard(
  db: StateDatabase,
): Promise<{ row?: SelfContinuityCardRecord; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(selfContinuityCard)
      .orderBy(desc(selfContinuityCard.createdAt))
      .limit(1);
    return { row: rows[0] };
  } catch {
    return {
      degraded: makeDegraded("state_unreadable", "projection", "Check state database connectivity"),
    };
  }
}

export async function readSelfContinuityCardById(
  db: StateDatabase,
  id: string,
): Promise<{ row?: SelfContinuityCardRecord; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db.select().from(selfContinuityCard).where(eq(selfContinuityCard.id, id));
    return { row: rows[0] };
  } catch {
    return {
      degraded: makeDegraded("state_unreadable", "projection", "Check state database connectivity"),
    };
  }
}

export async function updateSelfContinuityCardStatus(
  db: StateDatabase,
  id: string,
  status: SelfContinuityCardRecord["status"],
): Promise<SelfContinuityCardRecord | undefined> {
  try {
    await db.db.update(selfContinuityCard).set({ status }).where(eq(selfContinuityCard.id, id));
    const rows = await db.db.select().from(selfContinuityCard).where(eq(selfContinuityCard.id, id));
    return rows[0];
  } catch {
    return undefined;
  }
}

// ───────────────────────────────────────────────────────────────
// AutonomousChangeLedger (T8.1.1)
// ───────────────────────────────────────────────────────────────

export interface WriteAutonomousChangeLedgerOptions {
  id: string;
  createdAt: string;
  workspaceRoot: string;
  changeKind: AutonomousChangeLedgerRecord["changeKind"];
  targetId: string;
  previousStableRef?: string;
  status?: AutonomousChangeLedgerRecord["status"];
  gateResultsJson?: string;
  rollbackRef?: string;
  rollbackCommandHint?: string;
  sourceRefs: SourceRef[];
  redactedPayloadJson?: string;
  activatedAt?: string;
  rolledBackAt?: string;
}

export async function writeAutonomousChangeLedger(
  db: StateDatabase,
  options: WriteAutonomousChangeLedgerOptions,
): Promise<AutonomousChangeLedgerRecord> {
  if (options.sourceRefs.length === 0) {
    throw new Error("autonomous_change_ledger sourceRefs required");
  }
  const row: NewAutonomousChangeLedgerRecord = {
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
  return row as AutonomousChangeLedgerRecord;
}

export async function readAutonomousChangeLedgerById(
  db: StateDatabase,
  id: string,
): Promise<AutonomousChangeLedgerRecord | undefined> {
  const rows = await db.db.select().from(autonomousChangeLedger).where(eq(autonomousChangeLedger.id, id));
  return rows[0];
}

export async function readAutonomousChangeLedgerByTarget(
  db: StateDatabase,
  targetId: string,
  limit = 50,
): Promise<{ rows: AutonomousChangeLedgerRecord[]; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(autonomousChangeLedger)
      .where(eq(autonomousChangeLedger.targetId, targetId))
      .orderBy(desc(autonomousChangeLedger.createdAt))
      .limit(limit);
    return { rows };
  } catch {
    return {
      rows: [],
      degraded: makeDegraded("state_unreadable", "projection", "Check state database connectivity"),
    };
  }
}

export async function readAutonomousChangeLedgerByStatus(
  db: StateDatabase,
  status: AutonomousChangeLedgerRecord["status"],
): Promise<{ rows: AutonomousChangeLedgerRecord[]; degraded?: DegradedOperationResult }> {
  try {
    const rows = await db.db
      .select()
      .from(autonomousChangeLedger)
      .where(eq(autonomousChangeLedger.status, status))
      .orderBy(desc(autonomousChangeLedger.createdAt));
    return { rows };
  } catch {
    return {
      rows: [],
      degraded: makeDegraded("state_unreadable", "projection", "Check state database connectivity"),
    };
  }
}

export async function updateAutonomousChangeLedgerStatus(
  db: StateDatabase,
  id: string,
  status: AutonomousChangeLedgerRecord["status"],
  patch?: Partial<
    Pick<
      AutonomousChangeLedgerRecord,
      "gateResultsJson" | "rollbackRef" | "rollbackCommandHint" | "activatedAt" | "rolledBackAt"
    >
  >,
): Promise<AutonomousChangeLedgerRecord | undefined> {
  try {
    const set: Partial<AutonomousChangeLedgerRecord> = { status, ...patch };
    await db.db.update(autonomousChangeLedger).set(set).where(eq(autonomousChangeLedger.id, id));
    const rows = await db.db.select().from(autonomousChangeLedger).where(eq(autonomousChangeLedger.id, id));
    return rows[0];
  } catch {
    return undefined;
  }
}

// ───────────────────────────────────────────────────────────────
// Re-export serialization helpers for downstream v9 modules
// ───────────────────────────────────────────────────────────────

export { serializeSourceRefs, parseSourceRefs };
