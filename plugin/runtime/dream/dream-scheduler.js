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
import { runDream } from "./dream-engine.js";
const DEFAULT_LOCK_TTL_MS = 35 * 60 * 1000; // 35 min (covers 30 min operator timeout + buffer)
// In-memory lock fallback when no lockPort is provided
export function memoryLockPort() {
    const locks = new Map();
    return {
        async acquireLock(input) {
            const key = input.windowKey;
            const existing = locks.get(key);
            if (existing && existing.expiresAt > Date.now()) {
                return { acquired: false, existingRunId: existing.runId };
            }
            locks.set(key, {
                runId: input.runId,
                expiresAt: Date.now() + input.ttlMs,
            });
            return { acquired: true };
        },
        async releaseLock(input) {
            const key = input.windowKey;
            const existing = locks.get(key);
            if (existing && existing.runId === input.runId) {
                locks.delete(key);
            }
        },
    };
}
export async function scheduleDream(input) {
    const lock = input.lockPort ?? memoryLockPort();
    const windowKey = input.windowKey ?? "dream_lock:default";
    // Acquire lock
    const lockResult = await lock.acquireLock({
        runId: input.runId,
        windowKey,
        ttlMs: DEFAULT_LOCK_TTL_MS,
    });
    if (!lockResult.acquired) {
        const reason = input.triggerKind === "quiet_completion"
            ? "skip:lock_held"
            : `lock_held_by:${lockResult.existingRunId ?? "unknown"}`;
        return {
            runId: input.runId,
            status: "skipped",
            reason,
        };
    }
    // Run Dream asynchronously; do not await so heartbeat is not blocked
    runDream({
        runId: input.runId,
        traceId: input.traceId,
        triggerKind: input.triggerKind,
        statePort: input.statePort,
        modelPort: input.modelPort,
        modelAssistPort: input.modelAssistPort,
        tracePort: input.tracePort,
        budgetPort: input.budgetPort,
        options: input.options,
    })
        .then(async (result) => {
        await lock.releaseLock({ runId: input.runId, windowKey });
        return result;
    })
        .catch(async (err) => {
        console.error("[dream-scheduler] runDream failed:", err);
        await lock.releaseLock({ runId: input.runId, windowKey });
    });
    return {
        runId: input.runId,
        status: "started",
    };
}
function isHourInWindow(hour, start, end) {
    if (start < end) {
        return hour >= start && hour < end;
    }
    return hour >= start || hour < end;
}
export function shouldTrigger(policy) {
    switch (policy.type) {
        case "cron": {
            if (!policy.lastRunAt) {
                return { shouldRun: true, reason: "first_run" };
            }
            const last = new Date(policy.lastRunAt).getTime();
            const next = last + policy.intervalHours * 60 * 60 * 1000;
            if (Date.now() >= next) {
                return { shouldRun: true, reason: "cron_due" };
            }
            return {
                shouldRun: false,
                reason: `next_run_at:${new Date(next).toISOString()}`,
            };
        }
        case "evidence_threshold": {
            const delta = policy.currentEvidenceCount - policy.lastRunEvidenceCount;
            if (delta >= policy.threshold) {
                return {
                    shouldRun: true,
                    reason: `threshold_reached:${delta}/${policy.threshold}`,
                };
            }
            return {
                shouldRun: false,
                reason: `below_threshold:${delta}/${policy.threshold}`,
            };
        }
        case "manual": {
            return { shouldRun: true, reason: "manual_trigger" };
        }
        case "quiet_completion": {
            const hour = new Date(policy.quietCompletedAt).getUTCHours();
            if (isHourInWindow(hour, policy.windowStartHour, policy.windowEndHour)) {
                return { shouldRun: true, reason: "quiet_completion_in_window" };
            }
            return { shouldRun: false, reason: "skip:out_of_window" };
        }
    }
}
