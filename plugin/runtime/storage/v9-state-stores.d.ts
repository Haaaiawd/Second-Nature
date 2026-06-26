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
import { type AttentionSignalRecord, type ActivityThreadRecord, type ActivityStepRecord, type ToolRoutineRecord, type ProceduralProjectionRecord, type ConnectorEvolutionPlanRecord } from "./db/schema/v9-entities.js";
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
export { serializeSourceRefs, parseSourceRefs };
