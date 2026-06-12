/**
 * HeartbeatOrchestrator — v8 control-plane heartbeat cycle trace writer.
 *
 * Core logic: Emit ordered HeartbeatCycleTrace, invoke perception/judgment
 * ports, and return cycle result without making semantic action decisions.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/control-plane-system.md`
 * - `.anws/v8/04_SYSTEM_DESIGN/shared-v8-contracts.md §3`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (writeHeartbeatCycleTrace, readHeartbeatCycleTraces)
 * - `src/observability/loop-stage-event-sink.js` (recordLoopStageEvent)
 * - `src/core/second-nature/perception/perception-builder.js` (buildPerceptionCards)
 * - `src/core/second-nature/perception/judgment-engine.js` (runAgentJudgments)
 *
 * Boundary:
 * - Does NOT make semantic decisions about action allowability.
 * - Does NOT bypass ActionPolicyDecision.
 * - Degrades gracefully on DB failure or downstream unavailable.
 *
 * Test coverage: tests/unit/control-plane/heartbeat-cycle-trace.test.ts
 */

import type { StateDatabase } from "../../../storage/db/index.js";
import {
  writeHeartbeatCycleTrace,
  readHeartbeatCycleTraces,
} from "../../../storage/v8-state-stores.js";
import { recordLoopStageEvent } from "../../../observability/loop-stage-event-sink.js";
import { buildPerceptionCards } from "../perception/perception-builder.js";
import { runAgentJudgments } from "../perception/judgment-engine.js";
import { loadAcceptedProjections } from "./accepted-projection-loader.js";
import {
  buildActionProposal,
  type BuildActionProposalResult,
} from "../action/action-proposal-builder.js";
import { evaluateActionPolicy } from "../action/autonomy-policy-evaluator.js";
import { dispatchAllowedAction } from "../action/policy-bound-dispatch.js";
import {
  recordNoActionClosure,
  recordRememberClosure,
  recordPolicyOutcomeClosure,
  recordExecutionClosure,
  type ClosureStatus,
} from "../action/action-closure-recorder.js";
import { checkDailyRhythm, type DailyRhythmState } from "../quiet-dream/daily-rhythm-scheduler.js";
import type {
  SourceRef,
  DegradedOperationResult,
  V8ReasonCode,
} from "../../../shared/types/v8-contracts.js";

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

export interface HeartbeatOrchestrationRequest {
  workspaceRoot: string;
  requestedAt?: string;
  trigger?: "scheduled" | "manual" | "host";
}

export interface HeartbeatOrchestrationResult {
  cycleId: string;
  cycleSequence: number;
  closureRef?: SourceRef;
  noActionReason?: V8ReasonCode;
  degraded?: DegradedOperationResult;
  rhythmState?: DailyRhythmState;
}

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

async function nextCycleSequence(db: StateDatabase): Promise<number> {
  const result = await readHeartbeatCycleTraces(db, 1);
  if (result.degraded || result.rows.length === 0) {
    return 1;
  }
  return (result.rows[0]?.cycleSequence ?? 0) + 1;
}

function buildCycleId(sequence: number, now: string): string {
  return `cyc_${now.replace(/[:.]/g, "")}_${sequence}`;
}

async function advanceAndRecordDailyRhythm(
  db: StateDatabase,
  cycleId: string,
  cycleSequence: number,
  cycleRef: SourceRef,
  now: string,
): Promise<{ rhythmState?: DailyRhythmState; rhythmDegraded?: DegradedOperationResult }> {
  try {
    const rhythmResult = await checkDailyRhythm(db, { now });
    if ("status" in rhythmResult && rhythmResult.status === "checked") {
      await recordLoopStageEvent(db, {
        id: `evt_${cycleId}_daily_rhythm`,
        cycleId,
        cycleSequence,
        stage: "quiet",
        status: "completed",
        occurredAt: new Date().toISOString(),
        sourceRefs: [
          cycleRef,
          {
            uri: `sn://rhythm/${rhythmResult.state.day}`,
            family: "dream_run",
            id: `rhythm_${rhythmResult.state.day}`,
            redactionClass: "none",
            resolveStatus: "resolvable",
          },
        ],
      });
      return { rhythmState: rhythmResult.state };
    }
    const degraded = rhythmResult as DegradedOperationResult;
    await recordLoopStageEvent(db, {
      id: `evt_${cycleId}_daily_rhythm`,
      cycleId,
      cycleSequence,
      stage: "quiet",
      status: "failed",
      occurredAt: new Date().toISOString(),
      reason: degraded.reason,
      sourceRefs: [cycleRef],
    });
    return { rhythmDegraded: degraded };
  } catch (rhythmErr) {
    const errMsg = rhythmErr instanceof Error ? rhythmErr.message : String(rhythmErr);
    const degraded: DegradedOperationResult = {
      status: "degraded",
      reason: "state_unreadable",
      ownerStage: "quiet",
      sourceRefs: [cycleRef],
      operatorNextAction: `Daily rhythm check failed: ${errMsg.slice(0, 120)}`,
      retryable: true,
    };
    await recordLoopStageEvent(db, {
      id: `evt_${cycleId}_daily_rhythm`,
      cycleId,
      cycleSequence,
      stage: "quiet",
      status: "failed",
      occurredAt: new Date().toISOString(),
      reason: degraded.reason,
      sourceRefs: [cycleRef],
    });
    return { rhythmDegraded: degraded };
  }
}

// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────

export async function runHeartbeatCycle(
  db: StateDatabase,
  request: HeartbeatOrchestrationRequest,
): Promise<HeartbeatOrchestrationResult | DegradedOperationResult> {
  const now = request.requestedAt ?? new Date().toISOString();
  const cycleSequence = await nextCycleSequence(db);
  const cycleId = buildCycleId(cycleSequence, now);

  const cycleRef: SourceRef = {
    uri: `sn://heartbeat/${cycleId}`,
    family: "audit",
    id: cycleId,
    redactionClass: "none",
    resolveStatus: "resolvable",
  };

  // Write cycle trace — started
  const traceResult = await writeHeartbeatCycleTrace(db, {
    id: cycleId,
    cycleSequence,
    heartbeatStartedAt: now,
    inputCount: 0,
    outputCount: 0,
    status: "started",
    sourceRefs: [cycleRef],
  });

  if ("reason" in traceResult) {
    return {
      status: "degraded",
      reason: "state_unreadable",
      ownerStage: "ingestion",
      sourceRefs: [cycleRef],
      operatorNextAction: "Retry heartbeat after DB recovery",
      retryable: true,
    };
  }

  // Record ingestion stage started
  await recordLoopStageEvent(db, {
    id: `evt_${cycleId}_ingestion`,
    cycleId,
    cycleSequence,
    stage: "ingestion",
    status: "started",
    occurredAt: now,
    sourceRefs: [cycleRef],
  });

  // ── Perception stage ──
  const perceptionResult = await buildPerceptionCards(db, { cycleId, now });

  const perceptionDegraded = "status" in perceptionResult && perceptionResult.status === "degraded"
    ? perceptionResult
    : null;

  await recordLoopStageEvent(db, {
    id: `evt_${cycleId}_perception`,
    cycleId,
    cycleSequence,
    stage: "perception",
    status: perceptionDegraded ? "failed" : "completed",
    occurredAt: new Date().toISOString(),
    reason: perceptionDegraded
      ? (perceptionResult as any).reason
      : undefined,
    sourceRefs: [cycleRef],
  });

  if (perceptionDegraded || !("cards" in perceptionResult)) {
    // Degraded path must still write a closure for observability
    const degradedReason = perceptionDegraded
      ? ((perceptionResult as any).reason ?? "state_unreadable")
      : "perception_failed";
    const closureResult = await recordNoActionClosure(db, cycleId, degradedReason as V8ReasonCode, { now });
    let degradedClosureRef: SourceRef | undefined;
    if ("closureId" in closureResult) {
      degradedClosureRef = {
        uri: `sn://closure/${closureResult.closureId}`,
        family: "action_closure",
        id: closureResult.closureId,
        redactionClass: "none",
        resolveStatus: "resolvable",
      };
    }

    await recordLoopStageEvent(db, {
      id: `evt_${cycleId}_closure`,
      cycleId,
      cycleSequence,
      stage: "closure",
      status: "failed",
      occurredAt: new Date().toISOString(),
      reason: degradedReason,
      sourceRefs: degradedClosureRef ? [degradedClosureRef, cycleRef] : [cycleRef],
    });

    const { rhythmState } = await advanceAndRecordDailyRhythm(db, cycleId, cycleSequence, cycleRef, now);

    return {
      cycleId,
      cycleSequence,
      closureRef: degradedClosureRef,
      noActionReason: degradedReason as V8ReasonCode,
      degraded: perceptionDegraded
        ? {
            status: "degraded",
            reason: (perceptionResult as any).reason ?? "state_unreadable",
            ownerStage: "perception",
            sourceRefs: [cycleRef],
            operatorNextAction: "Retry heartbeat after perception recovery",
            retryable: true,
          }
        : undefined,
      rhythmState,
    };
  }

  const cards = perceptionResult.cards;
  if (cards.length === 0) {
    // No cards → no judgment needed
    await recordLoopStageEvent(db, {
      id: `evt_${cycleId}_judgment`,
      cycleId,
      cycleSequence,
      stage: "judgment",
      status: "skipped",
      occurredAt: new Date().toISOString(),
      reason: "evidence_batch_empty",
      sourceRefs: [cycleRef],
    });

    // Write no-action closure — every cycle must produce exactly one
    const closureResult = await recordNoActionClosure(db, cycleId, "evidence_batch_empty", { now });
    let emptyClosureRef: SourceRef | undefined;
    if ("closureId" in closureResult) {
      emptyClosureRef = {
        uri: `sn://closure/${closureResult.closureId}`,
        family: "action_closure",
        id: closureResult.closureId,
        redactionClass: "none",
        resolveStatus: "resolvable",
      };
    }

    await recordLoopStageEvent(db, {
      id: `evt_${cycleId}_closure`,
      cycleId,
      cycleSequence,
      stage: "closure",
      status: "completed",
      occurredAt: new Date().toISOString(),
      reason: "evidence_batch_empty",
      sourceRefs: emptyClosureRef ? [emptyClosureRef, cycleRef] : [cycleRef],
    });

    const { rhythmState } = await advanceAndRecordDailyRhythm(db, cycleId, cycleSequence, cycleRef, now);

    return {
      cycleId,
      cycleSequence,
      closureRef: emptyClosureRef,
      noActionReason: "evidence_batch_empty",
      rhythmState,
    };
  }

  // ── Context assembly: load accepted projections (T-DQ.R.3) ──
  const projectionResult = await loadAcceptedProjections(db);
  const acceptedProjections = projectionResult.ok ? projectionResult.slice.projections : [];

  // ── Judgment stage ──
  const judgmentResult = await runAgentJudgments(
    db,
    cards.map((c) => c.id),
    { now, acceptedProjections },
  );

  const judgmentFailed = judgmentResult.failed.length > 0;

  await recordLoopStageEvent(db, {
    id: `evt_${cycleId}_judgment`,
    cycleId,
    cycleSequence,
    stage: "judgment",
    status: judgmentFailed ? "failed" : "completed",
    occurredAt: new Date().toISOString(),
    sourceRefs: [cycleRef],
  });

  // ── Action/Closure stage (T-CP.R.2) ──
  // Every cycle must produce exactly one closure or no-action record.
  let closureRef: SourceRef | undefined;
  let noActionReason: V8ReasonCode | undefined;
  let closureDegraded: DegradedOperationResult | undefined;

  // Record policy stage started
  await recordLoopStageEvent(db, {
    id: `evt_${cycleId}_policy`,
    cycleId,
    cycleSequence,
    stage: "policy",
    status: "started",
    occurredAt: new Date().toISOString(),
    sourceRefs: [cycleRef],
  });

  if (judgmentResult.succeeded.length === 0) {
    // No actionable verdicts → no-action closure
    const closureResult = await recordNoActionClosure(db, cycleId, "proposal_no_action", { now });
    if ("closureId" in closureResult) {
      closureRef = {
        uri: `sn://closure/${closureResult.closureId}`,
        family: "action_closure",
        id: closureResult.closureId,
        redactionClass: "none",
        resolveStatus: "resolvable",
      };
    } else if ("reason" in closureResult) {
      closureDegraded = closureResult;
    }
    noActionReason = "proposal_no_action";
  } else {
    // Find first actionable verdict (non-ignore, non-watch)
    const actionableVerdict = judgmentResult.succeeded.find(
      (v) => v.actionKind !== "ignore" && v.actionKind !== "watch",
    );

    if (!actionableVerdict) {
      // All verdicts are ignore/watch → no-action
      const closureResult = await recordNoActionClosure(db, cycleId, "proposal_no_action", { now });
      if ("closureId" in closureResult) {
        closureRef = {
          uri: `sn://closure/${closureResult.closureId}`,
          family: "action_closure",
          id: closureResult.closureId,
          redactionClass: "none",
          resolveStatus: "resolvable",
        };
      } else if ("reason" in closureResult) {
        closureDegraded = closureResult;
      }
      noActionReason = "proposal_no_action";
    } else {
      // Build proposal for the actionable verdict
      const proposalResult = await buildActionProposal(db, actionableVerdict.id, { now });

      if ("status" in proposalResult && proposalResult.status === "degraded") {
        // Proposal build failed — still need a closure
        closureDegraded = proposalResult as DegradedOperationResult;
        const closureResult = await recordNoActionClosure(db, cycleId, closureDegraded.reason, { now });
        if ("closureId" in closureResult) {
          closureRef = {
            uri: `sn://closure/${closureResult.closureId}`,
            family: "action_closure",
            id: closureResult.closureId,
            redactionClass: "none",
            resolveStatus: "resolvable",
          };
        }
        noActionReason = closureDegraded.reason;

        await recordLoopStageEvent(db, {
          id: `evt_${cycleId}_policy`,
          cycleId,
          cycleSequence,
          stage: "policy",
          status: "failed",
          occurredAt: new Date().toISOString(),
          reason: closureDegraded.reason,
          sourceRefs: closureDegraded.sourceRefs.length > 0 ? closureDegraded.sourceRefs : [cycleRef],
        });
      } else if ((proposalResult as BuildActionProposalResult).status === "no_action") {
        const noAction = proposalResult as { status: "no_action"; reason: V8ReasonCode };
        const closureResult = await recordNoActionClosure(db, cycleId, noAction.reason, { now });
        if ("closureId" in closureResult) {
          closureRef = {
            uri: `sn://closure/${closureResult.closureId}`,
            family: "action_closure",
            id: closureResult.closureId,
            redactionClass: "none",
            resolveStatus: "resolvable",
          };
        }
        noActionReason = noAction.reason;
      } else if ((proposalResult as BuildActionProposalResult).status === "remember_for_review") {
        const remember = proposalResult as {
          status: "remember_for_review";
          memoryReviewCandidate: import("../../../shared/types/v8-contracts.js").MemoryReviewCandidateClosure;
          closureId: string;
        };
        const closureResult = await recordRememberClosure(db, cycleId, remember.memoryReviewCandidate, { now });
        if ("closureId" in closureResult) {
          closureRef = {
            uri: `sn://closure/${closureResult.closureId}`,
            family: "action_closure",
            id: closureResult.closureId,
            redactionClass: "none",
            resolveStatus: "resolvable",
          };
        } else if ("reason" in closureResult) {
          closureDegraded = closureResult;
        }
      } else if ((proposalResult as BuildActionProposalResult).status === "proposal") {
        const { proposal } = proposalResult as { status: "proposal"; proposal: import("../action/action-proposal-builder.js").ActionProposal };

        // Evaluate policy — conservative defaults: no real platform permission, no auto-allow
        const decision = evaluateActionPolicy(
          proposal,
          {
            breakerStatus: "closed",
            platformPermissionDeclared: false,
            ownerPreferenceAllowAuto: false,
          },
          { now },
        );

        await recordLoopStageEvent(db, {
          id: `evt_${cycleId}_policy`,
          cycleId,
          cycleSequence,
          stage: "policy",
          status: "completed",
          occurredAt: new Date().toISOString(),
          reason: decision.decisionReason,
          sourceRefs: decision.proofRefs,
        });

        // Record execution stage started
        await recordLoopStageEvent(db, {
          id: `evt_${cycleId}_execution`,
          cycleId,
          cycleSequence,
          stage: "execution",
          status: "started",
          occurredAt: new Date().toISOString(),
          sourceRefs: decision.proofRefs,
        });

        // Dispatch — no real external write in T-CP.R.2
        const dispatchResult = dispatchAllowedAction(proposal, decision, { guidanceAvailable: false });

        // Record closure based on dispatch outcome
        if (dispatchResult.type === "none") {
          const closureStatus: ClosureStatus = decision.decision === "deny" ? "denied" : "deferred";
          const closureResult = await recordPolicyOutcomeClosure(
            db,
            cycleId,
            closureStatus,
            decision.decisionReason,
            {
              proposalId: proposal.id,
              decisionId: decision.id,
              platformId: proposal.targetPlatformId,
              capabilityId: proposal.targetCapabilityId,
              nextState: "await_next_cycle",
            },
            { now },
          );
          if ("closureId" in closureResult) {
            closureRef = {
              uri: `sn://closure/${closureResult.closureId}`,
              family: "action_closure",
              id: closureResult.closureId,
              redactionClass: "none",
              resolveStatus: "resolvable",
            };
          } else if ("reason" in closureResult) {
            closureDegraded = closureResult;
          }
        } else if (dispatchResult.type === "guidance_unavailable") {
          const closureResult = await recordPolicyOutcomeClosure(
            db,
            cycleId,
            "downgraded",
            "guidance_unavailable",
            {
              proposalId: proposal.id,
              decisionId: decision.id,
              platformId: proposal.targetPlatformId,
              capabilityId: proposal.targetCapabilityId,
              downgradedActionKind: dispatchResult.downgradedActionKind,
              nextState: "await_guidance_recovery",
            },
            { now },
          );
          if ("closureId" in closureResult) {
            closureRef = {
              uri: `sn://closure/${closureResult.closureId}`,
              family: "action_closure",
              id: closureResult.closureId,
              redactionClass: "none",
              resolveStatus: "resolvable",
            };
          } else if ("reason" in closureResult) {
            closureDegraded = closureResult;
          }
        } else if (dispatchResult.type === "guidance") {
          // Guidance draft dispatch — no external write
          const closureResult = await recordExecutionClosure(
            db,
            cycleId,
            "completed",
            "policy_allowed",
            {
              proposalId: proposal.id,
              decisionId: decision.id,
              platformId: proposal.targetPlatformId,
              capabilityId: proposal.targetCapabilityId,
              outputSummary: "Guidance draft dispatched (simulated)",
              nextState: "await_next_cycle",
            },
            { now },
          );
          if ("closureId" in closureResult) {
            closureRef = {
              uri: `sn://closure/${closureResult.closureId}`,
              family: "action_closure",
              id: closureResult.closureId,
              redactionClass: "none",
              resolveStatus: "resolvable",
            };
          } else if ("reason" in closureResult) {
            closureDegraded = closureResult;
          }
        } else if (dispatchResult.type === "connector") {
          // Connector dispatch — simulated, no real platform write (T-CP.R.2)
          const closureResult = await recordExecutionClosure(
            db,
            cycleId,
            "completed",
            "policy_allowed",
            {
              proposalId: proposal.id,
              decisionId: decision.id,
              platformId: proposal.targetPlatformId,
              capabilityId: proposal.targetCapabilityId,
              outputSummary: "Connector dispatch prepared (simulated — T-CP.R.2)",
              nextState: "await_real_execution",
            },
            { now },
          );
          if ("closureId" in closureResult) {
            closureRef = {
              uri: `sn://closure/${closureResult.closureId}`,
              family: "action_closure",
              id: closureResult.closureId,
              redactionClass: "none",
              resolveStatus: "resolvable",
            };
          } else if ("reason" in closureResult) {
            closureDegraded = closureResult;
          }
        }

        // Record execution stage completed
        await recordLoopStageEvent(db, {
          id: `evt_${cycleId}_execution`,
          cycleId,
          cycleSequence,
          stage: "execution",
          status: closureDegraded ? "failed" : "completed",
          occurredAt: new Date().toISOString(),
          reason: closureDegraded?.reason,
          sourceRefs: decision.proofRefs,
        });
      }
    }
  }

  // Record closure stage event
  await recordLoopStageEvent(db, {
    id: `evt_${cycleId}_closure`,
    cycleId,
    cycleSequence,
    stage: "closure",
    status: closureDegraded ? "failed" : "completed",
    occurredAt: new Date().toISOString(),
    reason: closureDegraded?.reason ?? noActionReason,
    sourceRefs: closureRef ? [closureRef, cycleRef] : [cycleRef],
  });

  // Final safety net: if somehow nothing was recorded, write a degraded no-action
  if (!closureRef && !noActionReason && !closureDegraded) {
    const fallback = await recordNoActionClosure(db, cycleId, "proposal_no_action", { now });
    if ("closureId" in fallback) {
      closureRef = {
        uri: `sn://closure/${fallback.closureId}`,
        family: "action_closure",
        id: fallback.closureId,
        redactionClass: "none",
        resolveStatus: "resolvable",
      };
    }
    noActionReason = "proposal_no_action";
  }

  // T-CP.R.3: Advance daily rhythm after closure/no-action
  const { rhythmState } = await advanceAndRecordDailyRhythm(db, cycleId, cycleSequence, cycleRef, now);

  return {
    cycleId,
    cycleSequence,
    closureRef,
    noActionReason,
    degraded: closureDegraded,
    rhythmState,
  };
}
