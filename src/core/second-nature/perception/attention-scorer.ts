/**
 * AttentionScorer — Rules-first scoring for v9 AttentionSignal.
 *
 * Core logic: Compute novelty, relevance, risk, possible actions, and
 * ActivityThread suggestions from evidence + context. No LLM is used for
 * scoring; all outputs are deterministic and contestable.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/attention-system.detail.md §1.1 §3.2-§3.5a`
 *
 * Dependencies:
 * - `src/shared/types/v9-contracts.js` (RepetitionKind, AttentionActionKind, SourceRef, ActivityThread)
 *
 * Boundary:
 * - Does not make final judgments.
 * - Does not mutate ActivityThread state.
 *
 * Test coverage: tests/unit/attention/v9-attention-assembler.test.ts
 */

import type {
  RepetitionKind,
  AttentionActionKind,
  SourceRef,
  ActivityThread,
  EvidenceItem,
} from "../../../shared/types/v9-contracts.js";
import type { StableEvidenceIdentity } from "../../../storage/v9-evidence-identity-port.js";

// ───────────────────────────────────────────────────────────────
// Config
// ───────────────────────────────────────────────────────────────

export const NOVELTY_DUPLICATE = 0.0;
export const NOVELTY_CHANGED = 0.5;
export const NOVELTY_NEW = 1.0;

export const RELEVANCE_HIGH = 0.8;
export const RELEVANCE_MEDIUM = 0.5;
export const RELEVANCE_LOW = 0.2;

export const ATTENTION_SUMMARY_MAX_CHARS = 280;
export const POSSIBLE_ACTIONS_MAX_COUNT = 4;
export const ACTION_RATIONALE_MAX_CHARS = 120;

export const ACTIVITY_THREAD_MAX_STEPS = 8;
export const ACTIVITY_THREAD_STALE_HEARTBEATS = 3;

export type SensitivityHint = "public_technical" | "public_general" | "private_context" | "sensitive";

// ───────────────────────────────────────────────────────────────
// Context types
// ───────────────────────────────────────────────────────────────

export interface AttentionContextGoal {
  text: string;
  tags?: string[];
}

export interface AttentionContextProjection {
  topic?: string;
  tags?: string[];
}

export interface AttentionContextBodyIntuition {
  recentPlatforms: string[];
}

export interface AttentionContextRoutine {
  routineId: string;
  capabilityPattern: string;
}

export interface AttentionContext {
  acceptedGoals: AttentionContextGoal[];
  activeProjections: AttentionContextProjection[];
  bodyIntuition: AttentionContextBodyIntuition;
  routineRegistry: AttentionContextRoutine[];
  activeActivityThreads: ActivityThread[];
  cycleSequence: number;
}

export interface RichEvidenceItem extends EvidenceItem {
  id: string;
  capabilityId: string;
  summary?: string;
  sensitivityHint?: SensitivityHint;
  tags?: string[];
}

// ───────────────────────────────────────────────────────────────
// Scoring helpers
// ───────────────────────────────────────────────────────────────

export function scoreNovelty(repetitionStatus: RepetitionKind): number {
  switch (repetitionStatus) {
    case "new":
      return NOVELTY_NEW;
    case "changed":
      return NOVELTY_CHANGED;
    case "duplicate":
    case "identity_unstable":
      return NOVELTY_DUPLICATE;
    default:
      return NOVELTY_DUPLICATE;
  }
}

function normalizeText(text: string | null | undefined): string {
  return (text ?? "").toLowerCase();
}

function hasOverlap(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null) return false;
  const na = normalizeText(a);
  const nb = normalizeText(b);
  return na.length > 0 && nb.length > 0 && (na.includes(nb) || nb.includes(na));
}

function tagOverlap(aTags: string[] | undefined, bTags: string[] | undefined): boolean {
  if (!aTags || !bTags) return false;
  const setA = new Set(aTags.map((t) => t.toLowerCase()));
  return bTags.some((t) => setA.has(t.toLowerCase()));
}

export function scoreRelevance(evidence: RichEvidenceItem, ctx: AttentionContext): number {
  const evidenceText = `${evidence.content ?? ""} ${evidence.summary ?? ""}`;

  for (const goal of ctx.acceptedGoals) {
    if (hasOverlap(evidenceText, goal.text)) return RELEVANCE_HIGH;
    if (tagOverlap(evidence.tags, goal.tags)) return RELEVANCE_HIGH;
  }

  for (const projection of ctx.activeProjections) {
    if (projection.topic && hasOverlap(evidenceText, projection.topic)) return RELEVANCE_MEDIUM;
    if (tagOverlap(evidence.tags, projection.tags)) return RELEVANCE_MEDIUM;
  }

  if (ctx.bodyIntuition.recentPlatforms.includes(evidence.platformId)) {
    return RELEVANCE_LOW;
  }

  return 0.0;
}

export function scoreRisk(evidence: RichEvidenceItem): "none" | "low" | "medium" | "high" {
  switch (evidence.sensitivityHint) {
    case "sensitive":
      return "high";
    case "private_context":
      return "medium";
    case "public_technical":
    case "public_general":
      return "low";
    default:
      return "low";
  }
}

function buildRationale(kind: AttentionActionKind, reason: string): string {
  const text = `${kind}:${reason}`;
  return text.length <= ACTION_RATIONALE_MAX_CHARS
    ? text
    : `${text.slice(0, ACTION_RATIONALE_MAX_CHARS - 1)}…`;
}

export function suggestActions(
  evidence: RichEvidenceItem,
  identity: StableEvidenceIdentity,
  ctx: AttentionContext,
): AttentionActionKind[] {
  const relevance = scoreRelevance(evidence, ctx);
  const risk = scoreRisk(evidence);
  const suggestions: AttentionActionKind[] = [];

  if (risk === "high") {
    suggestions.push("notify_owner");
    suggestions.push("watch");
  }

  if (risk !== "high" && identity.repetitionStatus === "new" && relevance >= RELEVANCE_MEDIUM) {
    suggestions.push("remember");
  }

  if (relevance >= RELEVANCE_MEDIUM && risk !== "high") {
    if (!suggestions.includes("watch")) suggestions.push("watch");
  }

  if (suggestions.length === 0) {
    suggestions.push("defer");
  }

  return suggestions.slice(0, POSSIBLE_ACTIONS_MAX_COUNT);
}

function matchesThreadTopic(evidence: RichEvidenceItem, thread: ActivityThread): boolean {
  if (hasOverlap(evidence.content, thread.currentFocus)) return true;
  if (hasOverlap(evidence.summary, thread.currentFocus)) return true;
  return thread.associations.some((assoc) => hasOverlap(evidence.content, assoc));
}

function findActiveThread(
  evidence: RichEvidenceItem,
  threads: ActivityThread[],
): ActivityThread | undefined {
  return threads.find((t) => t.status === "active" && matchesThreadTopic(evidence, t));
}

export function suggestActivityThread(
  evidence: RichEvidenceItem,
  identity: StableEvidenceIdentity,
  ctx: AttentionContext,
): { threadSuggestion: "create" | "continue" | "pause" | "complete" | "none"; activityThreadId?: string; reason?: string } {
  if (!evidence.sourceRefs || evidence.sourceRefs.length === 0) {
    return { threadSuggestion: "none" };
  }

  const related = findActiveThread(evidence, ctx.activeActivityThreads);

  if (related) {
    if (related.completedStepCount >= ACTIVITY_THREAD_MAX_STEPS) {
      return {
        activityThreadId: related.threadId,
        threadSuggestion: "pause",
        reason: "activity_thread_overlong",
      };
    }
    const heartbeatGap = ctx.cycleSequence - related.lastHeartbeatSequence;
    if (heartbeatGap > ACTIVITY_THREAD_STALE_HEARTBEATS) {
      return {
        activityThreadId: related.threadId,
        threadSuggestion: "pause",
        reason: "activity_thread_stale",
      };
    }
    return { activityThreadId: related.threadId, threadSuggestion: "continue" };
  }

  if (identity.repetitionStatus === "new" && scoreRelevance(evidence, ctx) >= RELEVANCE_MEDIUM) {
    return { threadSuggestion: "create" };
  }

  return { threadSuggestion: "none" };
}

export function generateSummary(
  evidence: RichEvidenceItem,
  identity: StableEvidenceIdentity,
  relevance: number,
  risk: "none" | "low" | "medium" | "high",
): string {
  const repetitionLabel = identity.repetitionStatus;
  const platformLabel = `${evidence.platformId}/${evidence.capabilityId}`;
  const contentSummary = evidence.summary ?? evidence.content ?? "(no summary)";
  const riskHint = risk === "high" ? " [high risk]" : risk === "medium" ? " [medium risk]" : "";
  const summary = `(${repetitionLabel}) ${platformLabel}: ${contentSummary}${riskHint}`;
  return summary.length <= ATTENTION_SUMMARY_MAX_CHARS
    ? summary
    : `${summary.slice(0, ATTENTION_SUMMARY_MAX_CHARS - 1)}…`;
}
