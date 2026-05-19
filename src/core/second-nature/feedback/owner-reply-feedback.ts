/**
 * T4.2.1 — Owner reply ingestion and RelationshipMemory feedback loop.
 *
 * When an owner replies to an outreach, this function:
 * 1. Appends a `SessionChronicle` entry with the reply context.
 * 2. Loads the current `RelationshipMemory`.
 * 3. Infers tone/timing/topic from the reply text and updates the memory.
 * 4. Persists the updated `RelationshipMemory` with source refs pointing to the chronicle entry.
 *
 * Boundaries:
 * - Does NOT generate outreach drafts; that is the guidance layer's job.
 * - Does NOT execute connectors; this is a pure state update path.
 * - Errors in relationship update must not break chronicle write (chronicle is source of truth).
 */
import type { StateDatabase } from "../../../storage/db/index.js";
import {
  createSessionChronicleStore,
  type SessionChronicleEntry,
  type OwnerReplySignal,
} from "../../../storage/chronicle/session-chronicle-store.js";
import {
  createRelationshipMemoryStore,
  type RelationshipMemory,
  type RelationshipMemoryUpdate,
  type TopicAffinity,
} from "../../../storage/relationship/relationship-memory-store.js";

const DEFAULT_POSITIVE_KEYWORDS = [
  "agree", "thanks", "appreciate", "helpful", "good", "great", "love", "like", "enjoy",
  "excited", "happy", "nice", "wonderful", "awesome", "perfect", "cool", "ok", "yes",
];
const DEFAULT_NEGATIVE_KEYWORDS = [
  "disagree", "frustrated", "annoying", "bad", "hate", "dislike", "angry", "upset",
  "disappointed", "concerned", "no", "not", "never", "wrong", "terrible", "awful",
  "useless", "stop", "don't",
];
const DEFAULT_BUSY_KEYWORDS = [
  "busy", "swamped", "occupied", "tight schedule", "no time", "later",
  "overloaded", "overwhelmed", "backlog", "not now", "another time", "schedule tight",
];

const DEFAULT_TOPIC_PATTERNS: Record<string, string[]> = {
  work: ["work", "project", "task", "job", "delivery", "deadline"],
  personal: ["family", "life", "health", "weekend", "trip"],
  tech: ["code", "system", "bug", "feature", "architecture", "design"],
  social: ["friend", "community", "meetup", "event", "collaboration"],
};

export interface ReplyInferenceConfig {
  positiveKeywords?: string[];
  negativeKeywords?: string[];
  busyKeywords?: string[];
  topicPatterns?: Record<string, string[]>;
}

export function inferTone(
  text: string,
  config?: ReplyInferenceConfig,
): "casual" | "direct" | "quiet" | "unknown" {
  const lower = text.toLowerCase();
  const positiveKeywords = config?.positiveKeywords ?? DEFAULT_POSITIVE_KEYWORDS;
  const negativeKeywords = config?.negativeKeywords ?? DEFAULT_NEGATIVE_KEYWORDS;
  const pos = positiveKeywords.filter((w) => lower.includes(w)).length;
  const neg = negativeKeywords.filter((w) => lower.includes(w)).length;
  if (neg >= pos && neg > 0) return "quiet"; // owner is negative → agent should be more reserved
  if (pos > 0) return "casual"; // positive → casual is fine
  return "unknown";
}

export function inferTiming(
  text: string,
  config?: ReplyInferenceConfig,
): "responsive" | "busy" | undefined {
  const lower = text.toLowerCase();
  const busyKeywords = config?.busyKeywords ?? DEFAULT_BUSY_KEYWORDS;
  if (busyKeywords.some((w) => lower.includes(w))) return "busy";
  if (lower.includes("quick") || lower.includes("prompt")) return "responsive";
  return undefined;
}

export function inferTopics(
  text: string,
  config?: ReplyInferenceConfig,
): string[] {
  const lower = text.toLowerCase();
  const topicPatterns = config?.topicPatterns ?? DEFAULT_TOPIC_PATTERNS;
  const topics: string[] = [];
  for (const [topic, patterns] of Object.entries(topicPatterns)) {
    if (patterns.some((p) => lower.includes(p))) {
      topics.push(topic);
    }
  }
  return topics;
}

export function mergeTopicAffinities(
  existing: TopicAffinity[],
  newTopics: string[],
): TopicAffinity[] {
  const map = new Map<string, number>(existing.map((t) => [t.topic, t.affinity]));
  for (const topic of newTopics) {
    map.set(topic, Math.min(1, (map.get(topic) ?? 0) + 0.1));
  }
  return Array.from(map.entries())
    .map(([topic, affinity]) => ({ topic, affinity }))
    .sort((a, b) => b.affinity - a.affinity);
}

function redactSensitive(text: string): string {
  return text
    .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, "[REDACTED_CARD]")
    .replace(/password[:\s=]+\S+/gi, "[REDACTED_PASSWORD]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[REDACTED_EMAIL]");
}

export interface ProcessOwnerReplyInput {
  /** The raw reply text from the owner. */
  replyText: string;
  /** The decisionId of the outreach this reply is responding to. */
  relatedDecisionId: string;
  /** Optional explicit owner signal (parsed by host or explicit UI). */
  explicitSignal?: OwnerReplySignal;
}

export interface ProcessOwnerReplyResult {
  chronicleEntryId: string;
  relationshipUpdated: boolean;
  priorMemory?: RelationshipMemory;
  updatedMemory?: RelationshipMemory;
  relationshipUpdateError?: string;
}

/**
 * Process an owner reply: write chronicle, update RelationshipMemory.
 */
export async function processOwnerReply(
  input: ProcessOwnerReplyInput,
  state: StateDatabase,
): Promise<ProcessOwnerReplyResult> {
  const chronicleStore = createSessionChronicleStore(state);
  const relStore = createRelationshipMemoryStore(state);
  const now = new Date().toISOString();

  // 1. Write chronicle entry (source of truth)
  const entryId = `owner_reply:${input.relatedDecisionId}:${Date.now()}`;
  const replyText = input.replyText?.trim() ?? "";
  const isEmpty = replyText.length === 0;

  const tone = isEmpty ? "unknown" : inferTone(replyText);
  const timing = isEmpty ? undefined : inferTiming(replyText);
  const topics = isEmpty ? [] : inferTopics(replyText);

  const chronicleEntry: SessionChronicleEntry = {
    entryId,
    eventKind: "owner_reply",
    actor: "owner",
    occurredAt: now,
    summary: redactSensitive(isEmpty ? "(empty reply)" : replyText.slice(0, 500)),
    result: "succeeded",
    sourceRefs: [{ sourceId: entryId, kind: "owner_reply", url: `chronicle://${entryId}` }],
    relatedDecisionId: input.relatedDecisionId,
    ownerReply: {
      tone,
      delayMinutes: input.explicitSignal?.delayMinutes,
      topics: topics.length > 0 ? topics : input.explicitSignal?.topics,
      explicitPreference: input.explicitSignal?.explicitPreference,
    },
  };

  await chronicleStore.appendSessionChronicle(chronicleEntry);

  // 2. Load and update RelationshipMemory (best-effort)
  let relationshipUpdated = false;
  let priorMemory: RelationshipMemory | undefined;
  let updatedMemory: RelationshipMemory | undefined;

  try {
    priorMemory = (await relStore.loadRelationshipMemory()) ?? undefined;

    const nextRevision = (priorMemory?.revision ?? 0) + 1;
    const topicAffinities = mergeTopicAffinities(
      priorMemory?.topicAffinities ?? [],
      topics,
    );

    const update: RelationshipMemoryUpdate = {
      relationshipId: priorMemory?.relationshipId ?? "default",
      revision: nextRevision,
      tonePreference: tone !== "unknown" ? tone : (priorMemory?.tonePreference ?? "unknown"),
      averageReplyDelayMinutes: input.explicitSignal?.delayMinutes ?? priorMemory?.averageReplyDelayMinutes,
      noReplyCount: 0, // owner replied → reset counter
      topicAffinities: topicAffinities.length > 0 ? topicAffinities : (priorMemory?.topicAffinities ?? []),
      lastInteractionAt: now,
      sourceRefs: [
        ...(priorMemory?.sourceRefs ?? []),
        { sourceId: entryId, kind: "owner_reply_feedback", url: `chronicle://${entryId}` },
      ],
      updatedAt: now,
    };

    await relStore.upsertRelationshipMemory(update);
    updatedMemory = (await relStore.loadRelationshipMemory()) ?? undefined;
    relationshipUpdated = true;
  } catch (err) {
    // Relationship update is best-effort; chronicle is the source of truth.
    // Missing memory update will be reflected in the next `explain relationship` query.
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.warn(`[owner-reply-feedback] RelationshipMemory update failed: ${errorMessage}`);
    return {
      chronicleEntryId: entryId,
      relationshipUpdated: false,
      priorMemory,
      updatedMemory,
      relationshipUpdateError: errorMessage,
    };
  }

  return {
    chronicleEntryId: entryId,
    relationshipUpdated,
    priorMemory,
    updatedMemory,
  };
}
