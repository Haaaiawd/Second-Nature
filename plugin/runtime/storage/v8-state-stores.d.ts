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
import type { StateDatabase } from "./db/index.js";
import { type EvidenceItemRecord, type NewEvidenceItemRecord, type PerceptionCardRecord, type NewPerceptionCardRecord, type JudgmentVerdictRecord, type NewJudgmentVerdictRecord, type ActionClosureRecordSelect, type ActionClosureRecordInsert, type QuietDailyReviewRecord, type NewQuietDailyReviewRecord, type DreamConsolidationRunRecord, type NewDreamConsolidationRunRecord, type LongTermMemoryProjectionRecord, type NewLongTermMemoryProjectionRecord, type HeartbeatCycleTraceRecord, type NewHeartbeatCycleTraceRecord, type LoopStageEventRecord, type NewLoopStageEventRecord, type ImpulseContextArtifactRecord, type NewImpulseContextArtifactRecord, type DailyRhythmStateRecord, type NewDailyRhythmStateRecord } from "./db/schema/v8-entities.js";
import type { SourceRef, DegradedOperationResult } from "../shared/types/v8-contracts.js";
export interface WriteValidationError {
    ok: false;
    degraded: DegradedOperationResult;
}
export interface WriteValidationOk<T> {
    ok: true;
    record: T;
}
export type WriteValidationResult<T> = WriteValidationOk<T> | WriteValidationError;
export declare function writeEvidenceItem(db: StateDatabase, row: Omit<NewEvidenceItemRecord, "sourceRefsJson"> & {
    sourceRefs: SourceRef[];
}): Promise<{
    id: string;
} | DegradedOperationResult>;
export declare function readEvidenceItemsByStatus(db: StateDatabase, lifecycleStatus: EvidenceItemRecord["lifecycleStatus"]): Promise<{
    rows: EvidenceItemRecord[];
    degraded?: DegradedOperationResult;
}>;
export declare function writePerceptionCard(db: StateDatabase, row: Omit<NewPerceptionCardRecord, "sourceRefsJson"> & {
    sourceRefs: SourceRef[];
}): Promise<{
    id: string;
} | DegradedOperationResult>;
export declare function readPerceptionCardsByCycle(db: StateDatabase, cycleId: string): Promise<{
    rows: PerceptionCardRecord[];
    degraded?: DegradedOperationResult;
}>;
export declare function readPerceptionCardById(db: StateDatabase, id: string): Promise<{
    row?: PerceptionCardRecord;
    degraded?: DegradedOperationResult;
}>;
export declare function writeJudgmentVerdict(db: StateDatabase, row: Omit<NewJudgmentVerdictRecord, "sourceRefsJson"> & {
    sourceRefs: SourceRef[];
}): Promise<{
    id: string;
} | DegradedOperationResult>;
export declare function readJudgmentVerdictsByCycle(db: StateDatabase, cycleId: string): Promise<{
    rows: JudgmentVerdictRecord[];
    degraded?: DegradedOperationResult;
}>;
export declare function readJudgmentVerdictById(db: StateDatabase, id: string): Promise<{
    row?: JudgmentVerdictRecord;
    degraded?: DegradedOperationResult;
}>;
export declare function writeActionClosureRecord(db: StateDatabase, row: Omit<ActionClosureRecordInsert, "sourceRefsJson"> & {
    sourceRefs: SourceRef[];
}): Promise<{
    id: string;
} | DegradedOperationResult>;
export declare function readActionClosuresByCycle(db: StateDatabase, cycleId: string): Promise<{
    rows: ActionClosureRecordSelect[];
    degraded?: DegradedOperationResult;
}>;
export declare function readActionClosuresByDay(db: StateDatabase, day: string): Promise<{
    rows: ActionClosureRecordSelect[];
    degraded?: DegradedOperationResult;
}>;
export declare function writeQuietDailyReview(db: StateDatabase, row: Omit<NewQuietDailyReviewRecord, "sourceRefsJson"> & {
    sourceRefs: SourceRef[];
}): Promise<{
    id: string;
} | DegradedOperationResult>;
export declare function readQuietDailyReviewById(db: StateDatabase, id: string): Promise<{
    row?: QuietDailyReviewRecord;
    degraded?: DegradedOperationResult;
}>;
export declare function readQuietDailyReviewsByDay(db: StateDatabase, day: string): Promise<{
    rows: QuietDailyReviewRecord[];
    degraded?: DegradedOperationResult;
}>;
export declare function writeDreamConsolidationRun(db: StateDatabase, row: Omit<NewDreamConsolidationRunRecord, "sourceRefsJson"> & {
    sourceRefs: SourceRef[];
}): Promise<{
    id: string;
} | DegradedOperationResult>;
export declare function readDreamConsolidationRunById(db: StateDatabase, id: string): Promise<{
    row?: DreamConsolidationRunRecord;
    degraded?: DegradedOperationResult;
}>;
export declare function readDreamConsolidationRunsByQuietId(db: StateDatabase, quietReviewId: string): Promise<{
    rows: DreamConsolidationRunRecord[];
    degraded?: DegradedOperationResult;
}>;
export declare function writeLongTermMemoryProjection(db: StateDatabase, row: Omit<NewLongTermMemoryProjectionRecord, "sourceRefsJson"> & {
    sourceRefs: SourceRef[];
}): Promise<{
    id: string;
} | DegradedOperationResult>;
export declare function readMemoryProjectionsByStatus(db: StateDatabase, status: LongTermMemoryProjectionRecord["status"]): Promise<{
    rows: LongTermMemoryProjectionRecord[];
    degraded?: DegradedOperationResult;
}>;
export declare function readMemoryProjectionsByTopic(db: StateDatabase, topicKey: string): Promise<{
    rows: LongTermMemoryProjectionRecord[];
    degraded?: DegradedOperationResult;
}>;
export declare function writeHeartbeatCycleTrace(db: StateDatabase, row: Omit<NewHeartbeatCycleTraceRecord, "sourceRefsJson"> & {
    sourceRefs?: SourceRef[];
}): Promise<{
    id: string;
} | DegradedOperationResult>;
export declare function readHeartbeatCycleTraces(db: StateDatabase, limit?: number): Promise<{
    rows: HeartbeatCycleTraceRecord[];
    degraded?: DegradedOperationResult;
}>;
export declare function writeLoopStageEvent(db: StateDatabase, row: Omit<NewLoopStageEventRecord, "sourceRefsJson"> & {
    sourceRefs: SourceRef[];
}): Promise<{
    id: string;
} | DegradedOperationResult>;
export declare function readLoopStageEventsByCycle(db: StateDatabase, cycleId: string): Promise<{
    rows: LoopStageEventRecord[];
    degraded?: DegradedOperationResult;
}>;
export declare function readLoopStageEventsByStage(db: StateDatabase, stage: LoopStageEventRecord["stage"], limit?: number): Promise<{
    rows: LoopStageEventRecord[];
    degraded?: DegradedOperationResult;
}>;
export declare function writeImpulseContextArtifact(db: StateDatabase, row: Omit<NewImpulseContextArtifactRecord, "sourceRefsJson"> & {
    sourceRefs: SourceRef[];
}): Promise<{
    id: string;
} | DegradedOperationResult>;
export declare function readImpulseContextArtifact(db: StateDatabase, sceneType: string, capabilityIntent?: string, platformId?: string): Promise<{
    row?: ImpulseContextArtifactRecord;
    degraded?: DegradedOperationResult;
}>;
export declare function writeDailyRhythmState(db: StateDatabase, row: Omit<NewDailyRhythmStateRecord, "sourceRefsJson"> & {
    sourceRefs: SourceRef[];
}): Promise<{
    id: string;
} | DegradedOperationResult>;
export declare function readDailyRhythmStateByDay(db: StateDatabase, day: string): Promise<{
    row?: DailyRhythmStateRecord;
    degraded?: DegradedOperationResult;
}>;
export declare function extractSourceRefs(row: {
    sourceRefsJson: string | null;
}): SourceRef[];
