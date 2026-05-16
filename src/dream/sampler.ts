/**
 * Dream input sampler.
 *
 * Core logic: when evidence count exceeds threshold, sample recent 7 days
 * plus key events (outreach, owner reply, goal milestone, high-confidence refs).
 * Goal: prevent token/cost explosion before LLM stage.
 * Test coverage: tests/integration/dream/t7-1-1-dream-pipeline.test.ts
 */

const DEFAULT_EVIDENCE_LIMIT = 1000;
const RECENT_DAYS = 7;

export interface SamplerInput {
  evidenceSummaries: Array<{
    id: string;
    summary: string;
    createdAt: string;
    kind?: string;
    confidence?: number;
  }>;
  chronicleSummaries: Array<{
    id: string;
    summary: string;
    createdAt: string;
  }>;
  evidenceLimit?: number;
}

export interface SamplerResult {
  sampledEvidenceIds: string[];
  sampledChronicleIds: string[];
  droppedCount: number;
  reason: string;
}

function isWithinDays(createdAt: string, days: number): boolean {
  const then = new Date(createdAt).getTime();
  const now = Date.now();
  return now - then <= days * 24 * 60 * 60 * 1000;
}

function isKeyEvent(item: SamplerInput["evidenceSummaries"][0]): boolean {
  if (!item.kind) return false;
  const keyKinds = [
    "outreach",
    "owner_reply",
    "goal_milestone",
    "delivery",
    "quiet_reflection",
  ];
  return keyKinds.includes(item.kind);
}

function isHighConfidence(item: SamplerInput["evidenceSummaries"][0]): boolean {
  return (item.confidence ?? 0) >= 0.7;
}

export function sampleDreamInput(input: SamplerInput): SamplerResult {
  const limit = input.evidenceLimit ?? DEFAULT_EVIDENCE_LIMIT;

  // Priority: recent 7 days + key events + high confidence
  const withPriority = input.evidenceSummaries.map((e) => ({
    ...e,
    priority:
      (isWithinDays(e.createdAt, RECENT_DAYS) ? 4 : 0) +
      (isKeyEvent(e) ? 2 : 0) +
      (isHighConfidence(e) ? 1 : 0),
  }));

  // Sort by priority desc, then createdAt desc
  withPriority.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.createdAt.localeCompare(a.createdAt);
  });

  const sampledEvidence = withPriority.slice(0, limit);
  const sampledEvidenceIds = sampledEvidence.map((e) => e.id);
  const droppedCount = input.evidenceSummaries.length - sampledEvidence.length;

  // Chronicle is usually small; keep all unless it also exceeds limit
  let sampledChronicleIds = input.chronicleSummaries.map((c) => c.id);
  if (sampledChronicleIds.length > limit) {
    sampledChronicleIds = sampledChronicleIds
      .sort((a, b) => b.localeCompare(a))
      .slice(0, limit);
  }

  const reason = droppedCount > 0
    ? `sampled_${sampledEvidenceIds.length}_of_${input.evidenceSummaries.length}_evidence;priority_recent+key+confidence`
    : "no_sampling_needed";

  return {
    sampledEvidenceIds,
    sampledChronicleIds,
    droppedCount,
    reason,
  };
}
