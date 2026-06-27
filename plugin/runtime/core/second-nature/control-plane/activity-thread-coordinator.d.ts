/**
 * ActivityThreadCoordinator — T2.2.4
 *
 * Core logic: Cross-heartbeat continuation spine for ActivityThread.
 * - Selects active/related thread based on AttentionSignal.threadSuggestion.
 * - Creates/continues/pauses/completes threads.
 * - Advances at most one bounded ActivityStep per heartbeat.
 * - Side-effecting steps (propose_action, policy_closure) are recorded but not
 *   executed here; they remain subject to action-closure-policy.
 * - Runaway prevention: max steps, stale heartbeat detection, blocked status.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/control-context-system.md §5.1`
 * - `.anws/v9/04_SYSTEM_DESIGN/control-context-system.detail.md §3.9`
 * - `.anws/v9/04_SYSTEM_DESIGN/memory-continuity-system.detail.md §3.1b`
 * - `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md §3.5`
 * - ADR-002: Attention is not Agent mind.
 *
 * Boundary:
 * - Does not run an unbounded internal action loop.
 * - Does not execute side effects.
 * - Agent-facing wording stays neutral ("ongoing thread", "possible next move");
 *   never claims Agent thoughts, feelings, or mandatory actions.
 *
 * Test coverage:
 * - `tests/unit/control-plane/v9-activity-thread-coordinator.test.ts`
 * - `tests/integration/v9/activity-thread-continuation.test.ts`
 */
import type { ActivityStep, ActivityThread, AttentionSignal, ContextSlice, EmbodiedContext, SourceRef } from "../../../shared/types/v9-contracts.js";
export declare const ACTIVITY_THREAD_MAX_STEPS = 8;
export declare const ACTIVITY_THREAD_STALE_HEARTBEATS = 6;
export interface ActivityThreadPort {
    loadActivityThreads(options: {
        workspaceRoot: string;
        status: ActivityThread["status"][];
        limit: number;
    }): Promise<ContextSlice<ActivityThread[]>>;
    createActivityThread(input: ActivityThread): Promise<ContextSlice<ActivityThread>>;
    appendActivityStep(input: ActivityStep): Promise<ContextSlice<ActivityStep>>;
    updateActivityThreadStatus(threadId: string, status: ActivityThread["status"], reason?: string): Promise<ContextSlice<ActivityThread>>;
    updateActivityThreadProgress(threadId: string, patch: Partial<Pick<ActivityThread, "status" | "currentFocus" | "completedStepCount" | "lastStepKind" | "blockerReason" | "stopCondition" | "lastHeartbeatSequence" | "nextPossibleMoves" | "updatedAt">>): Promise<ContextSlice<ActivityThread>>;
}
export interface ActivityStageEvent {
    cycleId: string;
    cycleSequence: number;
    stage: "activity";
    status: "started" | "completed" | "skipped" | "blocked" | "failed";
    reason?: string;
    sourceRefs: SourceRef[];
}
export interface ActivityThreadCoordinatorDeps {
    threadPort: ActivityThreadPort;
    recordLoopStageEvent?: (event: ActivityStageEvent) => Promise<void>;
}
export interface AdvanceActivityThreadOptions {
    cycleRef: {
        cycleId: string;
        cycleSequence: number;
    };
    attention: AttentionSignal;
    context: EmbodiedContext;
}
export type AdvanceActivityThreadResult = {
    status: "advanced";
    thread: ActivityThread;
    step: ActivityStep;
} | {
    status: "stopped";
    thread: ActivityThread;
    reason: string;
} | {
    status: "skipped";
    reason: string;
} | {
    status: "degraded";
    reason: string;
};
export declare function createActivityThreadCoordinator(deps: ActivityThreadCoordinatorDeps): {
    advanceActivityThread(options: AdvanceActivityThreadOptions): Promise<AdvanceActivityThreadResult>;
};
export declare function advanceActivityThread(options: AdvanceActivityThreadOptions & ActivityThreadCoordinatorDeps): Promise<AdvanceActivityThreadResult>;
