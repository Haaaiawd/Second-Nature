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
import type { DreamEngineInput } from "./types.js";
import type {
  DreamTriggerKind,
  DreamRunResult,
  DreamTracePort,
  DreamStatePort,
  DreamModelPort,
  DreamBudgetPort,
} from "./types.js";

export interface SchedulerInput {
  triggerKind: DreamTriggerKind;
  runId: string;
  traceId: string;
  statePort: DreamStatePort;
  modelPort?: DreamModelPort;
  tracePort?: DreamTracePort;
  budgetPort?: DreamBudgetPort;
  options?: DreamEngineInput["options"];
  lockPort?: DreamRunLockPort;
}

export interface DreamRunLockPort {
  acquireLock(input: {
    runId: string;
    windowKey: string;
    ttlMs: number;
  }): Promise<{ acquired: boolean; existingRunId?: string }>;
  releaseLock(input: { runId: string; windowKey: string }): Promise<void>;
}

export interface ScheduleResult {
  runId: string;
  status: "started" | "skipped" | "queued";
  reason?: string;
}

const DEFAULT_LOCK_TTL_MS = 35 * 60 * 1000; // 35 min (covers 30 min operator timeout + buffer)

// In-memory lock fallback when no lockPort is provided
const memoryLocks = new Map<string, { runId: string; expiresAt: number }>();

export function memoryLockPort(): DreamRunLockPort {
  return {
    async acquireLock(input) {
      const key = input.windowKey;
      const existing = memoryLocks.get(key);
      if (existing && existing.expiresAt > Date.now()) {
        return { acquired: false, existingRunId: existing.runId };
      }
      memoryLocks.set(key, {
        runId: input.runId,
        expiresAt: Date.now() + input.ttlMs,
      });
      return { acquired: true };
    },
    async releaseLock(input) {
      const key = input.windowKey;
      const existing = memoryLocks.get(key);
      if (existing && existing.runId === input.runId) {
        memoryLocks.delete(key);
      }
    },
  };
}

export async function scheduleDream(
  input: SchedulerInput,
): Promise<ScheduleResult> {
  const lock = input.lockPort ?? memoryLockPort();
  const windowKey = "dream_lock:default";

  // Acquire lock
  const lockResult = await lock.acquireLock({
    runId: input.runId,
    windowKey,
    ttlMs: DEFAULT_LOCK_TTL_MS,
  });

  if (!lockResult.acquired) {
    return {
      runId: input.runId,
      status: "skipped",
      reason: `lock_held_by:${lockResult.existingRunId ?? "unknown"}`,
    };
  }

  // Run Dream asynchronously; do not await so heartbeat is not blocked
  runDream({
    runId: input.runId,
    traceId: input.traceId,
    triggerKind: input.triggerKind,
    statePort: input.statePort,
    modelPort: input.modelPort,
    tracePort: input.tracePort,
    budgetPort: input.budgetPort,
    options: input.options,
  })
    .then(async (result) => {
      await lock.releaseLock({ runId: input.runId, windowKey });
      return result;
    })
    .catch(async () => {
      // Ensure lock is released even on unexpected failure
      await lock.releaseLock({ runId: input.runId, windowKey });
    });

  return {
    runId: input.runId,
    status: "started",
  };
}

// ─── Trigger policies ─────────────────────────────────────────────────────────

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

export type TriggerPolicy = CronPolicy | EvidenceThresholdPolicy | ManualPolicy;

export function shouldTrigger(policy: TriggerPolicy): {
  shouldRun: boolean;
  reason?: string;
} {
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
  }
}
