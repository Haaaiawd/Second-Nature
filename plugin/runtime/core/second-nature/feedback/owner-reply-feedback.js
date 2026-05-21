import { createSessionChronicleStore, } from "../../../storage/chronicle/session-chronicle-store.js";
import { createRelationshipMemoryStore, } from "../../../storage/relationship/relationship-memory-store.js";
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
const DEFAULT_TOPIC_PATTERNS = {
    work: ["work", "project", "task", "job", "delivery", "deadline"],
    personal: ["family", "life", "health", "weekend", "trip"],
    tech: ["code", "system", "bug", "feature", "architecture", "design"],
    social: ["friend", "community", "meetup", "event", "collaboration"],
};
export function inferTone(text, config) {
    const lower = text.toLowerCase();
    const positiveKeywords = config?.positiveKeywords ?? DEFAULT_POSITIVE_KEYWORDS;
    const negativeKeywords = config?.negativeKeywords ?? DEFAULT_NEGATIVE_KEYWORDS;
    const pos = positiveKeywords.filter((w) => lower.includes(w)).length;
    const neg = negativeKeywords.filter((w) => lower.includes(w)).length;
    if (neg >= pos && neg > 0)
        return "quiet"; // owner is negative → agent should be more reserved
    if (pos > 0)
        return "casual"; // positive → casual is fine
    return "unknown";
}
export function inferTiming(text, config) {
    const lower = text.toLowerCase();
    const busyKeywords = config?.busyKeywords ?? DEFAULT_BUSY_KEYWORDS;
    if (busyKeywords.some((w) => lower.includes(w)))
        return "busy";
    if (lower.includes("quick") || lower.includes("prompt"))
        return "responsive";
    return undefined;
}
export function inferTopics(text, config) {
    const lower = text.toLowerCase();
    const topicPatterns = config?.topicPatterns ?? DEFAULT_TOPIC_PATTERNS;
    const topics = [];
    for (const [topic, patterns] of Object.entries(topicPatterns)) {
        if (patterns.some((p) => lower.includes(p))) {
            topics.push(topic);
        }
    }
    return topics;
}
export function mergeTopicAffinities(existing, newTopics) {
    const map = new Map(existing.map((t) => [t.topic, t.affinity]));
    for (const topic of newTopics) {
        map.set(topic, Math.min(1, (map.get(topic) ?? 0) + 0.1));
    }
    return Array.from(map.entries())
        .map(([topic, affinity]) => ({ topic, affinity }))
        .sort((a, b) => b.affinity - a.affinity);
}
function redactSensitive(text) {
    return text
        .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, "[REDACTED_CARD]")
        .replace(/password[:\s=]+\S+/gi, "[REDACTED_PASSWORD]")
        .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[REDACTED_EMAIL]")
        .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[REDACTED_PHONE]")
        .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED_SSN]")
        .replace(/\b(?:sk-|pk-|Bearer\s+|api[_-]?key[:\s=]+)[A-Za-z0-9_\-\/+=]{20,}\b/gi, "[REDACTED_TOKEN]");
}
/**
 * Process an owner reply: write chronicle, update RelationshipMemory.
 */
export async function processOwnerReply(input, state) {
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
    const chronicleEntry = {
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
    let priorMemory;
    let updatedMemory;
    try {
        priorMemory = (await relStore.loadRelationshipMemory()) ?? undefined;
        const nextRevision = (priorMemory?.revision ?? 0) + 1;
        const topicAffinities = mergeTopicAffinities(priorMemory?.topicAffinities ?? [], topics);
        const update = {
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
    }
    catch (err) {
        // Relationship update is best-effort; chronicle is the source of truth.
        // Missing memory update will be reflected in the next `explain relationship` query.
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.warn(`[owner-reply-feedback] RelationshipMemory update failed: ${errorMessage}`);
        // Write a diagnostic chronicle entry so operators can trace the failure.
        await chronicleStore.appendSessionChronicle({
            entryId: `${entryId}:diagnostic`,
            eventKind: "system_notice",
            actor: "system",
            occurredAt: new Date().toISOString(),
            summary: `RelationshipMemory update failed: ${errorMessage}`,
            result: "failed",
            sourceRefs: [{ sourceId: entryId, kind: "owner_reply_feedback", url: `chronicle://${entryId}` }],
            relatedDecisionId: input.relatedDecisionId,
        });
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
