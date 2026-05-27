/**
 * Dream Scheduler
 *
 * Core logic: trigger Dream runs via cron schedule, evidence threshold, or manual
 * request. Uses DreamRunLock to prevent concurrent runs on the same workspace/input
 * window. Operator timeout is enforced via options in the engine call.
 *
 * - Cron: simplified — checks if a scheduled window is due (last run + interval).
 * - Evidence threshold: triggers when evidence count exceeds threshold since last run.
 * - Manual: always allowed if no active lock.
 * - Lock: in-memory or port-backed; released after run completes or times out.
 * Test coverage: tests/integration/dream/t7-1-2-dream-scheduler.test.ts
 */
import type { DreamEngineInput } from "./types.js";
import type { DreamTriggerKind, DreamTracePort, DreamStatePort, DreamModelPort, DreamBudgetPort, ModelAssistPort } from "./types.js";
export interface SchedulerInput {
    triggerKind: DreamTriggerKind;
    runId: string;
    traceId: string;
    statePort: DreamStatePort;
    /** @deprecated Use modelAssistPort (DR-027). */
    modelPort?: DreamModelPort;
    modelAssistPort?: ModelAssistPort;
    tracePort?: DreamTracePort;
    budgetPort?: DreamBudgetPort;
    options?: DreamEngineInput["options"];
    lockPort?: DreamRunLockPort;
    windowKey?: string;
}
export interface DreamRunLockPort {
    acquireLock(input: {
        runId: string;
        windowKey: string;
        ttlMs: number;
    }): Promise<{
        acquired: boolean;
        existingRunId?: string;
    }>;
    releaseLock(input: {
        runId: string;
        windowKey: string;
    }): Promise<void>;
}
export interface ScheduleResult {
    runId: string;
    status: "started" | "skipped" | "queued";
    reason?: string;
}
export declare function memoryLockPort(): DreamRunLockPort;
export declare function scheduleDream(input: SchedulerInput): Promise<ScheduleResult>;
export interface CronPolicy {
    type: "cron";
    intervalHours: number;
    lastRunAt?: string;
}
export interface EvidenceThresholdPolicy {
    type: "evidence_threshold";
    threshold: number;
    currentEvidenceCount: number;
    lastRunEvidenceCount: number;
}
export interface ManualPolicy {
    type: "manual";
}
export interface QuietCompletionPolicy {
    type: "quiet_completion";
    quietCompletedAt: string;
    windowStartHour: number;
    windowEndHour: number;
}
export type TriggerPolicy = CronPolicy | EvidenceThresholdPolicy | ManualPolicy | QuietCompletionPolicy;
export declare function shouldTrigger(policy: TriggerPolicy): {
    shouldRun: boolean;
    reason?: string;
};
