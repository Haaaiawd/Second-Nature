/**
 * v9 Loop Health Aggregator (T8.2.1).
 *
 * Aggregates stage events, cycle traces, activity thread states, card results,
 * routine registry, connector evolution results, and character events into a
 * `LoopHealth` read model.
 *
 * Core logic:
 * - `aggregateLoopHealth`: classify stage events → stageAttribution + overall
 * - `aggregateActivityThreadHealth`: stale/overlong/missing-closure/blocked
 * - `aggregateContinuityHealth`: card available/stale/missing + projection counts
 * - `aggregateRoutineHealth`: installed/pending/denied + rollbackReady
 * - `aggregateConnectorEvolutionHealth`: gate summary + canary + rollback
 * - `aggregateCharacterFrameHealth`: deferred/conflict/accepted/rejected
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/observability-recovery-system.detail.md §3.3-§3.6 §4.1`
 * - `.anws/v9/04_SYSTEM_DESIGN/observability-recovery-system.md §5.1`
 * - ADR-004, ADR-006
 *
 * Dependencies:
 * - `src/shared/types/v9-contracts.js` (LoopHealth, ContinuityHealth, etc.)
 *
 * Boundary:
 * - Pure functions; no DB access, no filesystem, no network.
 * - All inputs are injected as snapshots/queries.
 * - Character health output must not contain emotion/personality/identity-lock text.
 *
 * Test coverage: `tests/unit/observability/v9-loop-health.test.ts`
 */
import type { LoopHealth, LoopStageKind, HealthOverall, ContinuityHealth, RoutineHealth, ConnectorEvolutionHealth, CharacterFrameEventKind, SourceRef } from "../shared/types/v9-contracts.js";
export declare const PERF: {
    readonly LOOP_STATUS_MAX_WINDOW_HOURS: 48;
    readonly ACTIVITY_THREAD_STALE_HEARTBEATS: 6;
    readonly ACTIVITY_THREAD_MAX_STEPS: 8;
};
export declare const LOOP_STAGE_KINDS: LoopStageKind[];
export interface StageEventInput {
    stageKind: string;
    status: string;
    reasonCode: string;
}
export interface CycleTraceInput {
    closedAt: string | null;
}
export interface ActivityThreadSnapshot {
    threadId: string;
    threadStatus: "active" | "paused" | "completed" | "abandoned" | "blocked";
    completedStepCount: number;
    lastHeartbeatSequence: number;
    lastStepKind?: string;
    closureLinked: boolean;
    sourceRefs: SourceRef[];
}
export interface ActivityThreadHealthOutput {
    threadId: string;
    threadStatus: ActivityThreadSnapshot["threadStatus"];
    status: HealthOverall;
    reasonCode: string | null;
    completedStepCount: number;
    lastHeartbeatSequence: number;
    closureLinked: boolean;
    sourceRefs: SourceRef[];
}
export interface SelfContinuityCardAssemblyResultInput {
    kind: "ok" | "unavailable";
    reasonCode?: string;
    isStale?: boolean;
    card?: {
        sourceRefs: SourceRef[];
    };
    projections?: {
        kind: "memory" | "procedural";
    }[];
}
export interface ToolRoutineRegistrySnapshotInput {
    routines: {
        routineId: string;
        capabilityPattern: string;
        version: string;
        status: "candidate" | "validated" | "active" | "retired";
        rollbackRef?: string;
        healthReason?: string;
        sourceRefs: SourceRef[];
    }[];
}
export interface ConnectorEvolutionResultInput {
    planId: string;
    platformId: string;
    gates: {
        name: string;
        result: "pass" | "fail" | "skipped";
    }[];
    canaryResult?: "pass" | "fail";
    rollbackAttempted?: boolean;
    rollbackSucceeded?: boolean;
    activeVersionRef?: string;
    previousStableRef?: string;
}
export interface CharacterFrameEventInput {
    frameId: string;
    eventKind: CharacterFrameEventKind;
    sourceRefCount: number;
}
export interface LoopHealthQuery {
    windowHours?: number;
    currentCycleSequence: number;
}
export interface LoopHealthInputs {
    stageEvents: StageEventInput[];
    cycleTraces: CycleTraceInput[];
    activityHealth: ActivityThreadHealthOutput[];
}
export declare function aggregateLoopHealth(inputs: LoopHealthInputs, query: LoopHealthQuery): LoopHealth;
export declare function aggregateActivityThreadHealth(snapshot: ActivityThreadSnapshot, currentCycleSequence: number): ActivityThreadHealthOutput;
export declare function aggregateContinuityHealth(cardResult: SelfContinuityCardAssemblyResultInput): ContinuityHealth;
export declare function aggregateRoutineHealth(registrySnapshot: ToolRoutineRegistrySnapshotInput): RoutineHealth;
export declare function aggregateConnectorEvolutionHealth(planResult: ConnectorEvolutionResultInput): ConnectorEvolutionHealth;
export interface CharacterFrameHealth {
    totalEvents: number;
    deferredCount: number;
    conflictCount: number;
    acceptedCount: number;
    rejectedCount: number;
    retiredCount: number;
    supersededCount: number;
    refreshedCount: number;
    /** True if any deferred/conflict events — health is degraded. */
    hasDeferredOrConflict: boolean;
    /** Safe observational text (no emotion/personality/identity-lock). */
    summary: string;
}
export declare function aggregateCharacterFrameHealth(events: CharacterFrameEventInput[]): CharacterFrameHealth;
export interface LoopStatusResult {
    loop: LoopHealth;
    continuity: ContinuityHealth;
    routine: RoutineHealth;
    connectorEvolution: ConnectorEvolutionHealth;
    character: CharacterFrameHealth;
    /** Overall health across all dimensions. */
    overall: HealthOverall;
}
export interface LoopStatusInputs extends LoopHealthInputs {
    continuityCardResult: SelfContinuityCardAssemblyResultInput;
    routineRegistrySnapshot: ToolRoutineRegistrySnapshotInput;
    connectorEvolutionResult: ConnectorEvolutionResultInput;
    characterFrameEvents: CharacterFrameEventInput[];
}
export declare function aggregateLoopStatus(inputs: LoopStatusInputs, query: LoopHealthQuery): LoopStatusResult;
