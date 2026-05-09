import { randomUUID } from "crypto";

import {
  buildOutreachMessage,
  decideDecisionBasis,
  evaluateGuards,
  evaluateOutreach,
  planIntent,
  selectRhythmWindow,
  type ContinuitySnapshot,
  type RhythmPolicy,
} from "../../../../src/core/second-nature/index.js";
import type { DecisionLedger } from "../../../../src/observability/services/decision-ledger.js";
import type { EffectDispatcher } from "../../../../src/core/second-nature/orchestrator/effect-dispatcher.js";

export interface TickSignal {
  id: string;
  source: "cron" | "heartbeat" | "platform_event" | "user_interrupt" | "resume";
  receivedAt: string;
}

export interface DecisionCycleHarness {
  ingestTick(signal: TickSignal, snapshot: ContinuitySnapshot): Promise<{ status: string; decisionId?: string; intentId?: string }>;
}

export function createDecisionCycleHarness(input: {
  rhythmPolicy: RhythmPolicy;
  decisionLedger: DecisionLedger;
  effectDispatcher: EffectDispatcher;
  outreachModel: {
    evaluateOutreachCandidate(payload: {
      candidateId: string;
      summary: string;
      sourceRefs: string[];
      recentOutreachHashes: string[];
      requiredUserHelp?: boolean;
    }): Promise<{
      valueScore: number;
      novelty: number;
      userRelevance: number;
      actionability: number;
      urgency: number;
      requiredUserHelp: boolean;
      isRoutineProgress: boolean;
      minThreshold: number;
      sourceRefs: string[];
      explanation?: string;
    }>;
  };
}): DecisionCycleHarness {
  const { rhythmPolicy, decisionLedger, effectDispatcher, outreachModel } = input;

  return {
    async ingestTick(signal: TickSignal, snapshot: ContinuitySnapshot): Promise<{ status: string; decisionId?: string; intentId?: string }> {
      const window = selectRhythmWindow(signal.receivedAt, snapshot, rhythmPolicy);

      const effectiveSnapshot: ContinuitySnapshot = {
        ...snapshot,
        mode: window.topLevelMode,
        currentWindowId: window.windowId,
      };

      const plannedIntents = planIntent(effectiveSnapshot);
      const interruptIntent = signal.source === "user_interrupt" && window.topLevelMode === "paused_for_interrupt"
        ? [{
            id: `intent-interrupt-${signal.id}`,
            kind: "maintenance" as const,
            priority: 1000,
            source: "interrupt" as const,
            summary: "handle high-value interrupt",
            effectClass: "maintenance" as const,
            platformId: undefined,
            sourceRefs: [],
            idempotencyKey: `interrupt:${signal.id}`,
          }]
        : [];

      const intents = [...interruptIntent, ...plannedIntents];
      for (const intent of intents) {
        const guard = evaluateGuards(intent, effectiveSnapshot);
        const decisionBasis = decideDecisionBasis(intent);
        const decisionId = randomUUID();
        const traceId = `trace:${decisionId}`;
        const interruptDeferred = intent.source === "interrupt" && window.topLevelMode === "paused_for_interrupt";
        const verdict = interruptDeferred ? "defer" : guard.verdict;
        const reasonCodes = interruptDeferred
          ? ["interrupt_handling"]
          : guard.reasons.length > 0 ? guard.reasons : ["guard_clear"];

        if (intent.kind === "outreach") {
          const gate = await evaluateOutreach(
            outreachModel,
            {
              candidateId: intent.id,
              summary: intent.summary,
              sourceRefs: [traceId],
              recentOutreachHashes: effectiveSnapshot.recentOutreachHashes,
              requiredUserHelp: true,
            }
          );

          const outreachVerdict = gate.allowed ? "allow" : "deny";
          await decisionLedger.recordDecision({
            id: decisionId,
            tickId: signal.id,
            traceId,
            intentId: intent.id,
            platformId: intent.platformId,
            verdict: outreachVerdict,
            mode: window.topLevelMode,
            reasons: gate.reasonCodes.length > 0 ? gate.reasonCodes : ["outreach_gate_passed"],
            reasonCodes: gate.reasonCodes.length > 0 ? gate.reasonCodes : ["outreach_gate_passed"],
            decisionBasis,
            evidenceRefs: gate.evaluation.sourceRefs,
            createdAt: new Date().toISOString(),
          });

          await decisionLedger.recordOutreachDecision({
            id: `${decisionId}:outreach`,
            tickId: signal.id,
            eventType: gate.allowed ? "outreach.sent" : "outreach.denied",
            platformId: intent.platformId,
            valueScore: gate.evaluation.valueScore,
            suppressionReason: gate.reasonCodes.join(","),
            messagePreview: gate.allowed
              ? buildOutreachMessage({ summary: intent.summary, evaluation: gate.evaluation }).intent.coreMeaning
              : undefined,
            createdAt: new Date().toISOString(),
          });

          return { status: gate.allowed ? "outreach_allowed" : "outreach_denied", decisionId, intentId: intent.id };
        }

        await decisionLedger.recordDecision({
          id: decisionId,
          tickId: signal.id,
          traceId,
          intentId: intent.id,
          platformId: intent.platformId,
          verdict,
          mode: window.topLevelMode,
          reasons: reasonCodes,
          reasonCodes,
          decisionBasis,
          evidenceRefs: [traceId],
          createdAt: new Date().toISOString(),
        });

        if (interruptDeferred) {
          return { status: "interrupt_deferred", decisionId, intentId: intent.id };
        }

        if (guard.verdict === "allow") {
          const result = await effectDispatcher.dispatchEffect(
            {
              id: intent.id,
              kind: intent.kind,
              summary: intent.summary,
              effectClass: intent.effectClass,
              platformId: intent.platformId,
              payload: { signalId: signal.id, mode: window.topLevelMode },
            },
            {
              decisionId,
              intentId: intent.id,
              tickId: signal.id,
              checkpointId: `checkpoint:${intent.id}:${signal.id}`,
              traceId,
            }
          );
          return { status: result.status, decisionId, intentId: intent.id };
        }

        if (guard.verdict === "escalate") {
          return { status: "escalated", decisionId, intentId: intent.id };
        }
      }

      return { status: "idle" };
    },
  };
}
