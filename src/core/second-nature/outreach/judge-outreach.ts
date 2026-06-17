/**
 * Control-plane outreach judgment (T2.3.1): value / interest / actionability / delivery / dedupe.
 *
 * Does not call guidance or perform delivery; callers supply guard-derived cooldown/duplicate flags.
 * Test coverage: tests/unit/core/outreach-judgment.test.ts
 */
import * as crypto from "node:crypto";
import type { CandidateIntent } from "../types.js";
import type { SourceRef } from "../../../shared/types/v8-contracts.js";
import {
  type DeliveryCapabilitySnapshot,
  type DeliveryTargetResolution,
  isDeliveryUnavailableReason,
  resolveDeliveryTarget,
} from "./delivery-target.js";

export type OutreachJudgmentVerdict = "allow" | "deny" | "defer";
export type CooldownState = "clear" | "cooling_down" | "duplicate";

export interface JudgeOutreachUserInterest {
  staleness: "fresh" | "stale" | "insufficient";
  confidence: number;
  signals: Array<{ topic: string; confidence: number; sourceRefs: SourceRef[] }>;
  sourceRefs: SourceRef[];
}

export interface JudgeOutreachLifeEvidence {
  empty: boolean;
  evidenceRefCount: number;
}

export interface JudgeOutreachInput {
  candidate: CandidateIntent;
  userInterest: JudgeOutreachUserInterest;
  lifeEvidence: JudgeOutreachLifeEvidence;
  delivery: DeliveryCapabilitySnapshot;
  duplicateBlocked?: boolean;
  cooldownBlocked?: boolean;
}

export interface OutreachJudgment {
  decisionId: string;
  candidateId: string;
  verdict: OutreachJudgmentVerdict;
  valueScore: number;
  userRelevance: number;
  actionability: number;
  interestRefs: SourceRef[];
  sourceRefs: SourceRef[];
  cooldownState: CooldownState;
  deliveryVerdict: DeliveryTargetResolution["verdict"];
  reasons: string[];
}

const OUTREACH_POLICY = {
  minValueScore: 0.35,
  minUserRelevance: 0.4,
  minActionabilityWhenInterestLow: 0.7,
} as const;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/g)
    .filter((t) => t.length > 1);
}

function signalMatchesSummary(sig: { topic: string }, summary: string): boolean {
  const s = summary.toLowerCase();
  const t = sig.topic.toLowerCase();
  if (t.length > 0 && s.includes(t)) return true;
  const wt = tokenize(sig.topic);
  const ws = new Set(tokenize(summary));
  return wt.some((x) => ws.has(x));
}

function matchInterestRefs(candidate: CandidateIntent, interest: JudgeOutreachUserInterest): SourceRef[] {
  const matched: SourceRef[] = [];
  for (const sig of interest.signals) {
    if (signalMatchesSummary(sig, candidate.summary)) {
      matched.push(...sig.sourceRefs);
    }
  }
  const byId = new Map<string, SourceRef>();
  for (const ref of matched) {
    byId.set(ref.id, ref);
  }
  return [...byId.values()];
}

function scoreOutreachValue(candidate: CandidateIntent, life: JudgeOutreachLifeEvidence): number {
  if (candidate.sourceRefs.length === 0) return 0;
  const base = 0.35 + Math.min(0.35, candidate.sourceRefs.length * 0.06) + Math.min(0.2, candidate.priority * 0.02);
  if (life.empty) return Math.max(0, base - 0.15);
  return Math.min(1, base + Math.min(0.1, life.evidenceRefCount * 0.01));
}

function scoreUserRelevance(candidate: CandidateIntent, interest: JudgeOutreachUserInterest): number {
  if (interest.staleness === "insufficient") {
    return Math.min(0.35, interest.confidence);
  }
  const refs = matchInterestRefs(candidate, interest);
  if (refs.length === 0) return interest.confidence * 0.45;
  return Math.min(1, interest.confidence * 0.65 + refs.length * 0.08);
}

function scoreActionability(
  candidate: CandidateIntent,
  interest: JudgeOutreachUserInterest,
  matchedInterestRefCount: number,
): number {
  if (candidate.effectClass !== "user_outreach") return 0.5;
  if (interest.staleness === "insufficient" && matchedInterestRefCount === 0) return 0.55;
  return 0.78;
}

function resolveCooldownState(input: JudgeOutreachInput): CooldownState {
  if (input.duplicateBlocked) return "duplicate";
  if (input.cooldownBlocked) return "cooling_down";
  return "clear";
}

export function judgeOutreach(input: JudgeOutreachInput): OutreachJudgment {
  const decisionId = `outreach_judgment:${crypto.randomUUID()}`;
  const deliveryResolution = resolveDeliveryTarget(input.delivery);
  const interestRefs = matchInterestRefs(input.candidate, input.userInterest);
  const valueScore = scoreOutreachValue(input.candidate, input.lifeEvidence);
  const userRelevance = scoreUserRelevance(input.candidate, input.userInterest);
  const actionability = scoreActionability(input.candidate, input.userInterest, interestRefs.length);
  const cooldownState = resolveCooldownState(input);

  const reasons: string[] = [];
  if (input.candidate.sourceRefs.length === 0) reasons.push("missing_source_refs");
  if (valueScore < OUTREACH_POLICY.minValueScore) reasons.push("value_score_too_low");
  if (
    userRelevance < OUTREACH_POLICY.minUserRelevance &&
    actionability < OUTREACH_POLICY.minActionabilityWhenInterestLow
  ) {
    reasons.push("not_interest_relevant_or_actionable");
  }
  if (cooldownState === "cooling_down") reasons.push("cooling_down");
  if (cooldownState === "duplicate") reasons.push("duplicate");
  if (deliveryResolution.verdict !== "target_available") {
    reasons.push(deliveryResolution.verdict);
  }

  const blockingReasons = reasons.filter((r) => !isDeliveryUnavailableReason(r));
  let verdict: OutreachJudgmentVerdict;
  if (blockingReasons.length === 0) {
    verdict = "allow";
  } else if (blockingReasons.includes("cooling_down") || blockingReasons.includes("duplicate")) {
    verdict = "defer";
  } else {
    verdict = "deny";
  }

  return {
    decisionId,
    candidateId: input.candidate.id,
    verdict,
    valueScore,
    userRelevance,
    actionability,
    interestRefs,
    sourceRefs: input.candidate.sourceRefs,
    cooldownState,
    deliveryVerdict: deliveryResolution.verdict,
    reasons: reasons.length === 0 ? ["outreach_allowed"] : reasons,
  };
}
