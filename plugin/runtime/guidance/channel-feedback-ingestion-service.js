/**
 * ChannelFeedbackIngestionService — T-GVS.C.2
 *
 * Core logic: process delivery result and owner reaction into RelationshipMemory;
 * retry with exponential backoff on persistence failure; audit on exhaustion.
 * Implements DR-029 (retry + audit; no silent loss) and ADR-006 (delivery truth).
 *
 * Boundary:
 * - Consumes ChannelFeedback from runtime-ops-system.
 * - Writes to state-memory-system via port (no direct DB access).
 * - On 3 failed retries, emits observability audit event (family: guidance.feedback_ingestion_failed)
 *   with feedback summary hash — never raw reaction content.
 * - Missing deliveryProof → deliveryResult coerced to "not_sent".
 *
 * Test coverage: tests/unit/guidance/channel-feedback-ingestion.test.ts
 */
// ─── Configuration ──────────────────────────────────────────────────────────
const RETRY_DELAYS_MS = [500, 1000, 2000];
const REACTION_WEIGHTS = {
    reply: 1.0,
    react: 0.5,
    ignore: -0.2,
    block: -1.0,
};
const REDACTION_PATTERNS = [
    /\b\d{3}-\d{3}-\d{4}\b/g, // phone
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // email
    /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, // credit card
];
const MIN_TRUST_THRESHOLD = -0.5;
// ─── Helpers ────────────────────────────────────────────────────────────────
function validateFeedback(feedback) {
    const errors = [];
    if (!feedback.deliveryResult) {
        errors.push("missing_delivery_result");
    }
    if (!feedback.ownerReaction) {
        errors.push("missing_owner_reaction");
    }
    if (!feedback.timestamp) {
        errors.push("missing_timestamp");
    }
    else {
        const ageDays = (Date.now() - new Date(feedback.timestamp).getTime()) / (1000 * 60 * 60 * 24);
        if (ageDays > 30) {
            errors.push("feedback_too_old");
        }
    }
    return { valid: errors.length === 0, errors };
}
function redactReactionContent(content) {
    if (!content)
        return content;
    let redacted = content;
    for (const pattern of REDACTION_PATTERNS) {
        redacted = redacted.replace(pattern, "[REDACTED]");
    }
    return redacted;
}
function coerceDeliveryResult(feedback) {
    if (feedback.deliveryResult === "sent") {
        const hasProof = Boolean(feedback.deliveryProof?.messageId?.trim()) || Boolean(feedback.deliveryProof?.hostProofRef);
        if (!hasProof) {
            return "not_sent";
        }
    }
    return feedback.deliveryResult;
}
function extractToneScore(content) {
    if (!content)
        return 0;
    const positiveWords = ["thanks", "good", "great", "love", "awesome"];
    const negativeWords = ["bad", "terrible", "hate", "wrong", "stop"];
    const lower = content.toLowerCase();
    const pos = positiveWords.filter((w) => lower.includes(w)).length;
    const neg = negativeWords.filter((w) => lower.includes(w)).length;
    if (pos > neg)
        return 1.0;
    if (neg > pos)
        return -0.5;
    return 0;
}
function extractTone(content) {
    const score = extractToneScore(content);
    if (score > 0.3)
        return "positive";
    if (score < -0.3)
        return "negative";
    return "neutral";
}
function calculateTiming(timestamp) {
    const hours = (Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60);
    if (hours < 1)
        return "immediate";
    if (hours < 24)
        return "delayed";
    return "very_delayed";
}
function buildRelationshipUpdate(feedback) {
    const redactedContent = redactReactionContent(feedback.reactionContent);
    const toneScore = extractToneScore(redactedContent);
    const reactionWeight = REACTION_WEIGHTS[feedback.ownerReaction];
    const deliverySuccess = coerceDeliveryResult(feedback) === "sent";
    return {
        channelId: feedback.channelId,
        timestamp: feedback.timestamp,
        trustDelta: reactionWeight * (1 + toneScore * 0.5),
        responsePattern: {
            reaction: feedback.ownerReaction,
            timing: calculateTiming(feedback.timestamp),
            tone: extractTone(redactedContent),
        },
        deliverySuccess,
    };
}
function applyTrustDecay(currentTrust, lastUpdated) {
    if (!lastUpdated)
        return currentTrust;
    const daysSince = (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
    const decayFactor = Math.pow(0.95, daysSince);
    return currentTrust * decayFactor;
}
function updateResponsePatterns(existing, update, observedAt) {
    const entry = {
        reaction: update.reaction,
        timing: update.timing,
        tone: update.tone,
        observedAt,
    };
    // Keep last 20 patterns
    return [...existing, entry].slice(-20);
}
function updateChannelPreferences(existing, channelId, deliverySuccess) {
    const map = new Map(existing.map((p) => [p.channelId, { ...p }]));
    const pref = map.get(channelId) ?? { channelId, successRate: 0.5 };
    // Exponential moving average of success rate
    pref.successRate = pref.successRate * 0.7 + (deliverySuccess ? 1 : 0) * 0.3;
    pref.lastUsedAt = new Date().toISOString();
    map.set(channelId, pref);
    return Array.from(map.values());
}
function generateStrategyAdjustments(update, memory) {
    const adjustments = [];
    if (memory.trustDelta < 0) {
        adjustments.push({
            type: "frequency",
            adjustment: "decrease",
            reason: "negative_trust_delta",
            value: 0.5,
        });
    }
    if (update.responsePattern.reaction === "block") {
        adjustments.push({
            type: "tone",
            adjustment: "more_cautious",
            reason: "user_blocked",
        });
    }
    if (update.responsePattern.timing === "very_delayed") {
        adjustments.push({
            type: "timing",
            adjustment: "increase_cooldown",
            reason: "slow_response",
        });
    }
    return adjustments;
}
async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function persistWithRetry(memory, port) {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        try {
            await port.updateRelationshipMemory(memory);
            return { success: true, retryCount: attempt };
        }
        catch {
            if (attempt < RETRY_DELAYS_MS.length) {
                await sleep(RETRY_DELAYS_MS[attempt]);
            }
        }
    }
    return { success: false, retryCount: RETRY_DELAYS_MS.length };
}
function hashSummary(feedback) {
    const data = `${feedback.channelId}:${feedback.deliveryResult}:${feedback.ownerReaction}:${feedback.timestamp}`;
    // Simple hash for test determinism; production uses crypto
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash + char) | 0;
    }
    return Math.abs(hash).toString(16).padStart(8, "0");
}
// ─── Service ────────────────────────────────────────────────────────────────
export async function ingestChannelFeedback(feedback, deps) {
    // Step 1: Validate
    const validation = validateFeedback(feedback);
    if (!validation.valid) {
        return { status: "rejected" };
    }
    // Step 2: Build relationship update (with redaction + delivery-truth coercion)
    const relationshipUpdate = buildRelationshipUpdate(feedback);
    // Step 3: Load current memory
    const currentMemory = await deps.relationshipPort.loadRelationshipMemory();
    // Step 4: Apply trust decay
    const decayedTrust = applyTrustDecay(currentMemory.trustDelta, currentMemory.lastUpdated);
    // Step 5: Compute new trust
    const newTrust = Math.max(MIN_TRUST_THRESHOLD, decayedTrust + relationshipUpdate.trustDelta);
    // Step 6: Update patterns and preferences
    const updatedPatterns = updateResponsePatterns(currentMemory.responsePatterns, relationshipUpdate.responsePattern, feedback.timestamp);
    const updatedPreferences = updateChannelPreferences(currentMemory.channelPreferences, feedback.channelId, relationshipUpdate.deliverySuccess);
    // Step 7: Assemble updated memory
    const updatedMemory = {
        ...currentMemory,
        trustDelta: newTrust,
        responsePatterns: updatedPatterns,
        channelPreferences: updatedPreferences,
        lastUpdated: new Date().toISOString(),
    };
    // Step 8: Persist with retry
    const persistResult = await persistWithRetry(updatedMemory, deps.relationshipPort);
    // Step 9: If all retries failed, audit and return failed_after_retries
    if (!persistResult.success) {
        await deps.auditPort.recordFeedbackIngestionFailed({
            feedbackId: feedback.messageId ?? "unknown",
            channelId: feedback.channelId,
            summaryHash: hashSummary(feedback),
            retryCount: persistResult.retryCount,
        });
        return {
            status: "failed_after_retries",
            relationshipUpdate,
            strategyAdjustments: generateStrategyAdjustments(relationshipUpdate, updatedMemory),
            updatedTrust: newTrust,
        };
    }
    // Step 10: Generate strategy adjustments
    const strategyAdjustments = generateStrategyAdjustments(relationshipUpdate, updatedMemory);
    return {
        status: "ingested",
        relationshipUpdate,
        strategyAdjustments,
        updatedTrust: newTrust,
    };
}
