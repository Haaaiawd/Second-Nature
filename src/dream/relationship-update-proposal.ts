/**
 * Relationship Update Proposal
 *
 * Core logic: generate relationship update proposal based on chronicle entries.
 * Tone/timing/topic deltas include sourceRefs and confidence.
 * Owner no-reply signal is recorded as cooldown without inventing preference.
 * Prevents over-inference from single samples.
 * Test coverage: tests/unit/dream/t7-1-5-relationship-update.test.ts
 */

import type { DreamRelationshipUpdate } from "./types.js";

export interface RelationshipProposalInput {
  chronicleEntries: Array<{
    id: string;
    summary: string;
    createdAt: string;
    kind?: string; // e.g. "outreach", "owner_reply", "user_interaction"
  }>;
  priorTone?: string;
  priorTiming?: string;
  priorTopic?: string;
}

export interface RelationshipProposalResult {
  proposal?: DreamRelationshipUpdate;
  unsupportedClaims: string[];
  cooldown?: boolean;
}

// Keywords for tone inference
const POSITIVE_TONE = [
  "agree", "thanks", "appreciate", "helpful", "good", "great",
  "love", "like", "enjoy", "excited", "happy",
];
const NEGATIVE_TONE = [
  "disagree", "frustrated", "annoying", "bad", "hate", "dislike",
  "angry", "upset", "disappointed", "concerned",
];
const BUSY_TIMING = [
  "busy", "swamped", "occupied", "tight schedule", "no time",
];

// Keywords for topic inference
const TOPIC_PATTERNS: Record<string, string[]> = {
  work: ["work", "project", "task", "job", "delivery", "deadline"],
  personal: ["family", "life", "health", "weekend", "trip"],
  tech: ["code", "system", "bug", "feature", "architecture", "design"],
  social: ["friend", "community", "meetup", "event", "collaboration"],
};

function inferTone(text: string): { tone: string; score: number } {
  const lower = text.toLowerCase();
  const pos = POSITIVE_TONE.filter((w) => lower.includes(w)).length;
  const neg = NEGATIVE_TONE.filter((w) => lower.includes(w)).length;
  if (pos > neg && pos > 0) return { tone: "positive", score: pos };
  if (neg > pos && neg > 0) return { tone: "negative", score: neg };
  if (pos === neg && pos > 0) return { tone: "mixed", score: pos };
  return { tone: "neutral", score: 0 };
}

function inferTiming(text: string): { timing: string; score: number } {
  const lower = text.toLowerCase();
  const busy = BUSY_TIMING.filter((w) => lower.includes(w)).length;
  if (busy > 0) return { timing: "busy", score: busy };
  // Check for quick replies (indicator in summary)
  if (lower.includes("quick reply") || lower.includes("prompt response")) {
    return { timing: "responsive", score: 1 };
  }
  return { timing: "normal", score: 0 };
}

function inferTopic(text: string): { topic: string; score: number } {
  const lower = text.toLowerCase();
  let bestTopic = "general";
  let bestScore = 0;
  for (const [topic, patterns] of Object.entries(TOPIC_PATTERNS)) {
    const score = patterns.filter((p) => lower.includes(p)).length;
    if (score > bestScore) {
      bestScore = score;
      bestTopic = topic;
    }
  }
  return { topic: bestTopic, score: bestScore };
}

export function draftRelationshipFromDream(
  input: RelationshipProposalInput,
): RelationshipProposalResult {
  const unsupportedClaims: string[] = [];

  const replyEntries = input.chronicleEntries.filter(
    (e) => e.kind === "owner_reply" || e.kind === "user_interaction",
  );

  // No-reply signal: if no owner replies, record cooldown without inventing preference
  if (replyEntries.length === 0) {
    return {
      unsupportedClaims: [],
      cooldown: true,
    };
  }

  // Prevent over-inference from single sample
  if (replyEntries.length < 2) {
    unsupportedClaims.push("single_sample_insufficient_for_relationship_inference");
  }

  // Aggregate tone/timing/topic across replies
  const toneVotes = new Map<string, number>();
  const timingVotes = new Map<string, number>();
  const topicVotes = new Map<string, number>();
  const sourceRefs: string[] = [];

  for (const entry of replyEntries) {
    const tone = inferTone(entry.summary);
    toneVotes.set(tone.tone, (toneVotes.get(tone.tone) ?? 0) + tone.score);

    const timing = inferTiming(entry.summary);
    timingVotes.set(timing.timing, (timingVotes.get(timing.timing) ?? 0) + timing.score);

    const topic = inferTopic(entry.summary);
    topicVotes.set(topic.topic, (topicVotes.get(topic.topic) ?? 0) + topic.score);

    sourceRefs.push(entry.id);
  }

  const topTone = Array.from(toneVotes.entries()).sort((a, b) => b[1] - a[1])[0];
  const topTiming = Array.from(timingVotes.entries()).sort((a, b) => b[1] - a[1])[0];
  const topTopic = Array.from(topicVotes.entries()).sort((a, b) => b[1] - a[1])[0];

  // Compute confidence based on sample size and signal strength
  const sampleSize = replyEntries.length;
  const signalStrength = Math.max(
    topTone?.[1] ?? 0,
    topTiming?.[1] ?? 0,
    topTopic?.[1] ?? 0,
  );
  const confidence = Math.min(
    0.9,
    0.3 + sampleSize * 0.05 + signalStrength * 0.05,
  );

  const toneDelta = topTone && topTone[1] > 0
    ? `tone_observed_${topTone[0]}`
    : undefined;
  const timingDelta = topTiming && topTiming[1] > 0
    ? `timing_observed_${topTiming[0]}`
    : undefined;
  const topicDelta = topTopic && topTopic[1] > 0
    ? `topic_observed_${topTopic[0]}`
    : undefined;

  return {
    proposal: {
      toneDelta,
      timingDelta,
      topicDelta,
      sourceRefs: sourceRefs.slice(0, 20),
      confidence: Number(confidence.toFixed(2)),
    },
    unsupportedClaims,
  };
}
