import type { OutreachEvaluationInput, OutreachEvaluationResult } from "../../../shared/types/outreach.js";

export interface OutreachModelAssistPort {
  evaluateOutreachCandidate(input: OutreachEvaluationInput): Promise<OutreachEvaluationResult>;
}

export interface OutreachPolicyConfig {
  minThreshold: number;
}

export interface OutreachGateResult {
  allowed: boolean;
  reasonCodes: string[];
  evaluation: OutreachEvaluationResult;
}

const DEFAULT_POLICY: OutreachPolicyConfig = {
  minThreshold: 0.65,
};

function buildCandidateFingerprint(input: OutreachEvaluationInput): string {
  const normalizedSummary = input.summary.toLowerCase().replace(/\s+/g, " ").trim();
  return `${input.candidateId}|${normalizedSummary}`;
}

function hasDuplicateOutreach(input: OutreachEvaluationInput): boolean {
  const fingerprint = buildCandidateFingerprint(input);
  return input.recentOutreachHashes.includes(input.candidateId) ||
    input.recentOutreachHashes.includes(fingerprint);
}

export async function evaluateOutreach(
  model: OutreachModelAssistPort,
  input: OutreachEvaluationInput,
  policy: Partial<OutreachPolicyConfig> = {}
): Promise<OutreachGateResult> {
  const resolved = {
    ...DEFAULT_POLICY,
    ...policy,
  };

  const evaluation = await model.evaluateOutreachCandidate(input);
  const reasonCodes: string[] = [];

  if (evaluation.sourceRefs.length === 0) {
    reasonCodes.push("missing_sources");
  }
  if (evaluation.valueScore < Math.max(evaluation.minThreshold, resolved.minThreshold)) {
    reasonCodes.push("value_below_threshold");
  }
  if (evaluation.isRoutineProgress) {
    reasonCodes.push("routine_progress_suppressed");
  }
  if (hasDuplicateOutreach(input)) {
    reasonCodes.push("recent_duplicate_outreach");
  }

  const urgencyOrActionable = evaluation.requiredUserHelp || evaluation.urgency > 0.5 || evaluation.actionability > 0.6;
  if (!urgencyOrActionable) {
    reasonCodes.push("insufficient_urgency_or_actionability");
  }

  return {
    allowed: reasonCodes.length === 0,
    reasonCodes,
    evaluation,
  };
}
