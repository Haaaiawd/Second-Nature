/**
 * DreamScheduler — Schedule Dream consolidation after Quiet completion.
 *
 * Core logic: Read a QuietDailyReview, create a DreamConsolidationRun
 * with lifecycle trace, and write it to state. Handles unavailable
 * scheduler by recording degraded state.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.detail.md §3.2`
 * - `.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.md §4.2`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (readQuietDailyReviewById, writeDreamConsolidationRun)
 * - `src/shared/types/v8-contracts.js` (SourceRef, DegradedOperationResult, V8ReasonCode)
 *
 * Boundary:
 * - Does not run consolidation; only schedules and records lifecycle.
 * - Does not form long-term memory; Dream runner does that.
 * - Degrades gracefully on missing review or unreadable state.
 *
 * Test coverage: tests/unit/dream/dream-scheduler-lifecycle.test.ts
 */

import type { StateDatabase } from "../../../storage/db/index.js";
import {
  readQuietDailyReviewById,
  writeDreamConsolidationRun,
} from "../../../storage/v8-state-stores.js";
import type {
  SourceRef,
  DegradedOperationResult,
  V8ReasonCode,
} from "../../../shared/types/v8-contracts.js";
import { classifyDegradedStatus } from "../../../shared/degraded-status-classifier.js";

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

export interface DreamScheduleResult {
  id: string;
  quietReviewId: string;
  status: "scheduled" | "started" | "completed" | "failed" | "blocked";
  reason?: V8ReasonCode;
  createdAt: string;
}

export interface ScheduleDreamAfterQuietOptions {
  now?: string;
  schedulerAvailable?: boolean;
}

// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────

export async function scheduleDreamAfterQuiet(
  db: StateDatabase,
  quietReviewId: string,
  options?: ScheduleDreamAfterQuietOptions,
): Promise<DreamScheduleResult | DegradedOperationResult> {
  const now = options?.now ?? new Date().toISOString();

  const readResult = await readQuietDailyReviewById(db, quietReviewId);
  if (readResult.degraded) {
    return readResult.degraded;
  }

  const review = readResult.row;
  if (!review) {
    return {
      status: classifyDegradedStatus("state_unreadable"),
      reason: "state_unreadable",
      ownerStage: "dream",
      sourceRefs: [],
      operatorNextAction: `QuietDailyReview ${quietReviewId} not found`,
      retryable: false,
    };
  }

  const runId = `dream_${quietReviewId}_${now.replace(/[:.]/g, "")}`;

  // Scheduler unavailable → record blocked state
  if (options?.schedulerAvailable === false) {
    const writeResult = await writeDreamConsolidationRun(db, {
      id: runId,
      createdAt: now,
      quietReviewId,
      status: "blocked",
      reason: "dream_scheduler_unavailable",
      sourceRefs: [
        {
          uri: `sn://dream/scheduler_unavailable/${quietReviewId}`,
          family: "dream_run",
          id: quietReviewId,
          redactionClass: "none",
          resolveStatus: "resolvable",
        },
      ],
      redactionClass: "none",
      payloadJson: JSON.stringify({ scheduledAt: now, blocked: true }),
    });

    if ("reason" in writeResult) {
      return writeResult;
    }

    return {
      id: runId,
      quietReviewId,
      status: "blocked",
      reason: "dream_scheduler_unavailable",
      createdAt: now,
    };
  }

  // Normal schedule
  const writeResult = await writeDreamConsolidationRun(db, {
    id: runId,
    createdAt: now,
    quietReviewId,
    status: "scheduled",
    sourceRefs: [
      {
        uri: `sn://dream/scheduled/${quietReviewId}`,
        family: "dream_run",
        id: quietReviewId,
        redactionClass: "none",
        resolveStatus: "resolvable",
      },
    ],
    redactionClass: "none",
    payloadJson: JSON.stringify({ scheduledAt: now }),
  });

  if ("reason" in writeResult) {
    return writeResult;
  }

  return {
    id: runId,
    quietReviewId,
    status: "scheduled",
    createdAt: now,
  };
}
