/**
 * CycleFinalizer — v8 exactly-one closure invariant (T-AC.R.2, T-AC.R.3)
 *
 * Core logic: provide a single boundary that records exactly one
 * ActionClosureRecord or no-action closure per heartbeat cycle.
 * Enforces idempotency key = cycleId, write order (closure row first),
 * and restart reconcile for orphaned closure/event rows.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/action-closure-policy-system.md §6.1a`
 * - `.anws/v8/04_SYSTEM_DESIGN/action-closure-policy-system.detail.md §3.4`
 * - `.anws/v8/04_SYSTEM_DESIGN/control-plane-system.md §3.4`
 *
 * Dependencies:
 * - `src/core/second-nature/action/action-closure-recorder.js`
 * - `src/storage/v8-state-stores.js`
 *
 * Boundary:
 * - One cycle → one closure row.
 * - Duplicate terminal closure for same cycleId → `unsafe` idempotency conflict.
 * - On partial failure, returns degraded diagnostic; caller records stage event.
 * - Reconcile detects orphaned closure (event missing) or orphaned event (closure missing).
 *
 * Test coverage: tests/unit/control-plane/cycle-finalizer.test.ts
 */

import type { StateDatabase } from "../../../storage/db/index.js";
import {
  recordNoActionClosure,
  recordPolicyOutcomeClosure,
  recordExecutionClosure,
} from "../action/action-closure-recorder.js";
import {
  readActionClosuresByCycle,
  readLoopStageEventsByCycle,
} from "../../../storage/v8-state-stores.js";
import type {
  DegradedOperationResult,
  V8ReasonCode,
  SourceRef,
} from "../../../shared/types/v8-contracts.js";
import { classifyDegradedStatus } from "../../../shared/degraded-status-classifier.js";

export interface CycleFinalizerResult {
  closureRef?: SourceRef;
  noActionReason?: V8ReasonCode;
  degraded?: DegradedOperationResult;
}

export type ClosureKind =
  | { kind: "no_action"; reason: V8ReasonCode }
  | {
      kind: "policy";
      closureStatus: "completed" | "denied" | "deferred" | "downgraded";
      reason: V8ReasonCode;
      proposalId: string;
      decisionId: string;
      platformId?: string;
      capabilityId?: string;
      downgradedActionKind?: string;
    }
  | {
      kind: "execution";
      closureStatus: "completed" | "failed";
      reason: V8ReasonCode;
      proposalId: string;
      decisionId: string;
      platformId?: string;
      capabilityId?: string;
      executionResultRef?: string;
      outputSummary?: string;
    };

// Terminal closure statuses — a cycle with any of these is considered finalized.
const TERMINAL_CLOSURE_STATUSES = new Set([
  "completed",
  "no_action",
  "denied",
  "deferred",
  "downgraded",
  "failed",
]);

/**
 * Check whether a cycle already has a terminal closure row.
 * This is the idempotency gate for `finalizeCycle`.
 */
async function checkExistingTerminalClosure(
  db: StateDatabase,
  cycleId: string,
): Promise<{ hasTerminal: boolean; existingClosureId?: string }> {
  const existing = await readActionClosuresByCycle(db, cycleId);
  if (existing.degraded) return { hasTerminal: false };
  const terminal = existing.rows.find((r) => TERMINAL_CLOSURE_STATUSES.has(r.status));
  if (terminal) return { hasTerminal: true, existingClosureId: terminal.id };
  return { hasTerminal: false };
}

export async function finalizeCycle(
  db: StateDatabase,
  cycleId: string,
  closure: ClosureKind,
  options?: { now?: string },
): Promise<CycleFinalizerResult> {
  const now = options?.now ?? new Date().toISOString();

  // Idempotency gate: check if this cycle already has a terminal closure.
  // recordNoActionClosure has its own idempotency check, but policy/execution do not.
  // We check uniformly here to enforce the exactly-one invariant.
  if (closure.kind !== "no_action") {
    const existing = await checkExistingTerminalClosure(db, cycleId);
    if (existing.hasTerminal) {
      return {
        degraded: {
          status: "unsafe",
          reason: "closure_idempotency_conflict",
          ownerStage: "closure",
          sourceRefs: [],
          operatorNextAction: `Cycle ${cycleId} already has terminal closure ${existing.existingClosureId}; duplicate finalize blocked`,
          retryable: false,
        },
      };
    }
  }

  switch (closure.kind) {
    case "no_action": {
      const result = await recordNoActionClosure(db, cycleId, closure.reason, { now });
      if ("closureId" in result) {
        return {
          closureRef: {
            uri: `sn://closure/${result.closureId}`,
            family: "action_closure",
            id: result.closureId,
            redactionClass: "none",
            resolveStatus: "resolvable",
          },
          noActionReason: closure.reason,
        };
      }
      return {
        noActionReason: closure.reason,
        degraded: result as DegradedOperationResult,
      };
    }
    case "policy": {
      const result = await recordPolicyOutcomeClosure(
        db,
        cycleId,
        closure.closureStatus,
        closure.reason,
        {
          proposalId: closure.proposalId,
          decisionId: closure.decisionId,
          platformId: closure.platformId,
          capabilityId: closure.capabilityId,
          downgradedActionKind: closure.downgradedActionKind,
        },
        { now },
      );
      if ("closureId" in result) {
        return {
          closureRef: {
            uri: `sn://closure/${result.closureId}`,
            family: "action_closure",
            id: result.closureId,
            redactionClass: "none",
            resolveStatus: "resolvable",
          },
        };
      }
      return { degraded: result as DegradedOperationResult };
    }
    case "execution": {
      const result = await recordExecutionClosure(
        db,
        cycleId,
        closure.closureStatus,
        closure.reason,
        {
          proposalId: closure.proposalId,
          decisionId: closure.decisionId,
          platformId: closure.platformId,
          capabilityId: closure.capabilityId,
          executionResultRef: closure.executionResultRef,
          outputSummary: closure.outputSummary,
        },
        { now },
      );
      if ("closureId" in result) {
        return {
          closureRef: {
            uri: `sn://closure/${result.closureId}`,
            family: "action_closure",
            id: result.closureId,
            redactionClass: "none",
            resolveStatus: "resolvable",
          },
        };
      }
      return { degraded: result as DegradedOperationResult };
    }
    default: {
      const exhaustive: never = closure as never;
      return {
        degraded: {
          status: classifyDegradedStatus("closure_failed"),
          reason: "closure_failed",
          ownerStage: "closure",
          sourceRefs: [],
          operatorNextAction: `Unknown closure kind: ${JSON.stringify(exhaustive)}`,
          retryable: false,
        },
      };
    }
  }
}

// ───────────────────────────────────────────────────────────────
// Reconcile — detect orphaned closure or stage event rows (T-AC.R.3)
// ───────────────────────────────────────────────────────────────

export interface ReconcileResult {
  /** Closure row exists but no closure stage event — event should be replayed. */
  orphanedClosure?: { closureId: string; cycleId: string };
  /** Stage event exists but no closure row — closure is missing, do not fabricate. */
  orphanedEvent?: { cycleId: string; stage: string };
  /** No orphan detected — cycle is consistent. */
  consistent: boolean;
  degraded?: DegradedOperationResult;
}

/**
 * Reconcile a cycle's closure and stage event rows.
 * Called at cycle start or by `loop_status` to detect partial-failure leftovers.
 *
 * Per design §6.1a:
 * - closure row written, event missing → replay event with traceRefs
 * - event written, closure row missing → report closure_unavailable / unsafe
 */
export async function reconcileCycleClosure(
  db: StateDatabase,
  cycleId: string,
): Promise<ReconcileResult> {
  const closures = await readActionClosuresByCycle(db, cycleId);
  if (closures.degraded) {
    return {
      consistent: false,
      degraded: closures.degraded,
    };
  }

  const events = await readLoopStageEventsByCycle(db, cycleId);
  if (events.degraded) {
    return {
      consistent: false,
      degraded: events.degraded,
    };
  }

  const terminalClosure = closures.rows.find((r) =>
    TERMINAL_CLOSURE_STATUSES.has(r.status),
  );
  const closureEvent = events.rows.find(
    (r) => r.stage === "closure" || r.stage === "action_closure",
  );

  if (terminalClosure && !closureEvent) {
    return {
      orphanedClosure: { closureId: terminalClosure.id, cycleId },
      consistent: false,
    };
  }

  if (!terminalClosure && closureEvent) {
    return {
      orphanedEvent: { cycleId, stage: closureEvent.stage },
      consistent: false,
    };
  }

  return { consistent: true };
}
