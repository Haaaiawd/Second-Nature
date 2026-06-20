/**
 * CycleFinalizer — v8 exactly-one closure invariant (T-AC.R.2)
 *
 * Core logic: provide a single boundary that records exactly one
 * ActionClosureRecord or no-action closure per heartbeat cycle.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/action-closure-policy-system.md §4.2`
 * - `.anws/v8/04_SYSTEM_DESIGN/control-plane-system.md §3.4`
 *
 * Dependencies:
 * - `src/core/second-nature/action/action-closure-recorder.js`
 * - `src/storage/v8-state-stores.js`
 *
 * Boundary:
 * - One cycle → one closure row.
 * - On partial failure, returns degraded diagnostic; caller records stage event.
 * - Does not emit multiple closures for the same cycle.
 *
 * Test coverage: tests/unit/control-plane/cycle-finalizer.test.ts
 */

import type { StateDatabase } from "../../../storage/db/index.js";
import {
  recordNoActionClosure,
  recordPolicyOutcomeClosure,
  recordExecutionClosure,
} from "../action/action-closure-recorder.js";
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

export async function finalizeCycle(
  db: StateDatabase,
  cycleId: string,
  closure: ClosureKind,
  options?: { now?: string },
): Promise<CycleFinalizerResult> {
  const now = options?.now ?? new Date().toISOString();

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
