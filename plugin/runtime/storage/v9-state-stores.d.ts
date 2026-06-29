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
import type { StateDatabase } from "./db/index.js";
import { type AttentionSignalRecord, type ActivityThreadRecord, type ActivityStepRecord, type ToolRoutineRecord, type ProceduralProjectionRecord, type ConnectorEvolutionPlanRecord, type CharacterFrameRecord, type SelfContinuityCardRecord, type AutonomousChangeLedgerRecord } from "./db/schema/v9-entities.js";
import type { SourceRef } from "../shared/types/v9-contracts.js";
import type { DegradedOperationResult } from "../shared/types/v8-contracts.js";
declare function serializeSourceRefs(refs: SourceRef[]): string;
declare function parseSourceRefs(json: string | null | undefined): SourceRef[];
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
export declare function writeAttentionSignal(db: StateDatabase, options: WriteAttentionSignalOptions): Promise<AttentionSignalRecord>;
export declare function readAttentionSignalById(db: StateDatabase, id: string): Promise<AttentionSignalRecord | undefined>;
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
export declare function writeActivityThread(db: StateDatabase, options: WriteActivityThreadOptions): Promise<ActivityThreadRecord>;
export declare function readActivityThreadById(db: StateDatabase, id: string): Promise<ActivityThreadRecord | undefined>;
export declare function readActivityThreadsByStatus(db: StateDatabase, status: ActivityThreadRecord["status"], options?: {
    limit?: number;
    orderBy?: "asc" | "desc";
}): Promise<ActivityThreadRecord[]>;
export declare function updateActivityThreadProgress(db: StateDatabase, id: string, patch: Partial<Pick<ActivityThreadRecord, "status" | "currentFocus" | "completedStepCount" | "lastStepKind" | "blockerReason" | "lastHeartbeatSequence" | "updatedAt">>): Promise<void>;
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
export declare function writeActivityStep(db: StateDatabase, options: WriteActivityStepOptions): Promise<ActivityStepRecord>;
export declare function readActivityStepsByThreadId(db: StateDatabase, threadId: string, limit?: number): Promise<ActivityStepRecord[]>;
export declare function readActiveToolRoutinesByCapabilityPattern(db: StateDatabase, capabilityPattern: string): Promise<ToolRoutineRecord[]>;
export declare function readToolRoutinesByStatus(db: StateDatabase, status: ToolRoutineRecord["status"]): Promise<{
    rows: ToolRoutineRecord[];
    degraded?: DegradedOperationResult;
}>;
export interface WriteToolRoutineOptions {
    id: string;
    name: string;
    version: string;
    capabilityPattern: string;
    status?: ToolRoutineRecord["status"];
    sourceRefs: SourceRef[];
    rollbackRef?: string;
    payloadJson?: string;
    activatedAt?: string;
    retiredAt?: string;
    createdAt: string;
}
export declare function writeToolRoutine(db: StateDatabase, options: WriteToolRoutineOptions): Promise<ToolRoutineRecord>;
export interface WriteProceduralProjectionOptions {
    id: string;
    createdAt: string;
    candidateId: string;
    capabilityPattern: string;
    status?: ProceduralProjectionRecord["status"];
    sourceRefs: SourceRef[];
    payloadJson?: string;
}
export declare function writeProceduralProjection(db: StateDatabase, options: WriteProceduralProjectionOptions): Promise<ProceduralProjectionRecord>;
export declare function readProceduralProjectionsByStatus(db: StateDatabase, status: ProceduralProjectionRecord["status"]): Promise<{
    rows: ProceduralProjectionRecord[];
    degraded?: DegradedOperationResult;
}>;
export declare function readProceduralProjectionsByCapabilityPattern(db: StateDatabase, capabilityPattern: string): Promise<{
    rows: ProceduralProjectionRecord[];
    degraded?: DegradedOperationResult;
}>;
export declare function updateProceduralProjectionStatus(db: StateDatabase, id: string, status: ProceduralProjectionRecord["status"], payloadJson?: string): Promise<ProceduralProjectionRecord | undefined>;
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
export declare function writeConnectorEvolutionPlan(db: StateDatabase, options: WriteConnectorEvolutionPlanOptions): Promise<ConnectorEvolutionPlanRecord>;
export declare function readConnectorEvolutionPlansByStatus(db: StateDatabase, status: ConnectorEvolutionPlanRecord["status"]): Promise<{
    rows: ConnectorEvolutionPlanRecord[];
    degraded?: DegradedOperationResult;
}>;
export declare function readConnectorEvolutionPlansByPlatform(db: StateDatabase, platformId: string): Promise<{
    rows: ConnectorEvolutionPlanRecord[];
    degraded?: DegradedOperationResult;
}>;
export declare function updateConnectorEvolutionPlanStatus(db: StateDatabase, id: string, status: ConnectorEvolutionPlanRecord["status"], payloadJson?: string): Promise<ConnectorEvolutionPlanRecord | undefined>;
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
export declare function writeCharacterFrame(db: StateDatabase, options: WriteCharacterFrameOptions): Promise<CharacterFrameRecord>;
export declare function readCharacterFrameById(db: StateDatabase, id: string): Promise<CharacterFrameRecord | undefined>;
export declare function readCharacterFramesByStatus(db: StateDatabase, status: CharacterFrameRecord["status"]): Promise<{
    rows: CharacterFrameRecord[];
    degraded?: DegradedOperationResult;
}>;
export declare function readLatestAcceptedCharacterFrame(db: StateDatabase): Promise<{
    row?: CharacterFrameRecord;
    degraded?: DegradedOperationResult;
}>;
export declare function readCharacterFrameRevisionCandidates(db: StateDatabase, revisionOf: string): Promise<{
    rows: CharacterFrameRecord[];
    degraded?: DegradedOperationResult;
}>;
export declare function updateCharacterFrameStatus(db: StateDatabase, id: string, status: CharacterFrameRecord["status"], patch?: Partial<Pick<CharacterFrameRecord, "supersededBy" | "revisionOf" | "acceptedAt" | "validFrom" | "validUntil" | "charCount" | "payloadJson">>): Promise<CharacterFrameRecord | undefined>;
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
export declare function writeSelfContinuityCard(db: StateDatabase, options: WriteSelfContinuityCardOptions): Promise<SelfContinuityCardRecord | undefined>;
export declare function readLatestSelfContinuityCard(db: StateDatabase): Promise<{
    row?: SelfContinuityCardRecord;
    degraded?: DegradedOperationResult;
}>;
export declare function readSelfContinuityCardById(db: StateDatabase, id: string): Promise<{
    row?: SelfContinuityCardRecord;
    degraded?: DegradedOperationResult;
}>;
export declare function updateSelfContinuityCardStatus(db: StateDatabase, id: string, status: SelfContinuityCardRecord["status"]): Promise<SelfContinuityCardRecord | undefined>;
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
export declare function writeAutonomousChangeLedger(db: StateDatabase, options: WriteAutonomousChangeLedgerOptions): Promise<AutonomousChangeLedgerRecord>;
export declare function readAutonomousChangeLedgerById(db: StateDatabase, id: string): Promise<AutonomousChangeLedgerRecord | undefined>;
export declare function readAutonomousChangeLedgerByTarget(db: StateDatabase, targetId: string, limit?: number): Promise<{
    rows: AutonomousChangeLedgerRecord[];
    degraded?: DegradedOperationResult;
}>;
export declare function readAutonomousChangeLedgerByStatus(db: StateDatabase, status: AutonomousChangeLedgerRecord["status"]): Promise<{
    rows: AutonomousChangeLedgerRecord[];
    degraded?: DegradedOperationResult;
}>;
export declare function updateAutonomousChangeLedgerStatus(db: StateDatabase, id: string, status: AutonomousChangeLedgerRecord["status"], patch?: Partial<Pick<AutonomousChangeLedgerRecord, "gateResultsJson" | "rollbackRef" | "rollbackCommandHint" | "activatedAt" | "rolledBackAt">>): Promise<AutonomousChangeLedgerRecord | undefined>;
export { serializeSourceRefs, parseSourceRefs };
