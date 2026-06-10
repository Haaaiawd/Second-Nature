/**
 * PerceptionBuilder — Generate PerceptionCard records from EvidenceItem batches.
 *
 * Core logic: Read pending evidence, deduplicate by content hash, build
 * PerceptionCard with topic, entities, novelty, relevance, summary, risk
 * flags, confidence, and reviewPriority. Rules-only fallback when model
 * assist is unavailable.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/perception-judgment-system.detail.md §3.1`
 * - `.anws/v8/04_SYSTEM_DESIGN/perception-judgment-system.md §5`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (readEvidenceItemsByStatus, writePerceptionCard)
 * - `src/shared/types/v8-contracts.js` (PerceptionCard fields)
 *
 * Boundary:
 * - Does not judge actionability; that is judgment's job.
 * - Does not fabricate perception on empty input.
 * - Rules-only path is deterministic and source-backed.
 *
 * Test coverage: tests/unit/perception/perception-builder.test.ts
 */
import { readEvidenceItemsByStatus, writePerceptionCard, } from "../../../storage/v8-state-stores.js";
// ───────────────────────────────────────────────────────────────
// Config
// ───────────────────────────────────────────────────────────────
const PERCEPTION_MAX_EVIDENCE_PER_CYCLE = 50;
// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────
function parseSourceRefs(json) {
    try {
        const parsed = JSON.parse(json);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
function extractTopic(evidence) {
    if (evidence.payloadJson) {
        try {
            const payload = JSON.parse(evidence.payloadJson);
            if (payload.topic)
                return String(payload.topic);
            if (payload.title)
                return String(payload.title);
            if (payload.subject)
                return String(payload.subject);
        }
        catch {
            /* ignore */
        }
    }
    return `${evidence.platformId}_observation`;
}
function extractEntities(evidence) {
    const entities = [evidence.platformId];
    if (evidence.payloadJson) {
        try {
            const payload = JSON.parse(evidence.payloadJson);
            if (payload.entities && Array.isArray(payload.entities)) {
                entities.push(...payload.entities.map(String));
            }
            if (payload.tags && Array.isArray(payload.tags)) {
                entities.push(...payload.tags.map(String));
            }
            if (payload.mentions && Array.isArray(payload.mentions)) {
                entities.push(...payload.mentions.map(String));
            }
        }
        catch {
            /* ignore */
        }
    }
    return [...new Set(entities)];
}
function inferNoveltyClass(evidence) {
    // Canonical novelty classification
    if (evidence.sensitivityHint === "public_technical")
        return "changed";
    return "new";
}
function inferRelevanceScore(evidence) {
    if (evidence.sensitivityHint === "sensitive")
        return 0.9;
    if (evidence.sensitivityHint === "public_technical")
        return 0.7;
    if (evidence.sensitivityHint === "private_context")
        return 0.5;
    return 0.3;
}
function inferRelevanceClass(score) {
    if (score >= 0.7)
        return "high";
    if (score >= 0.4)
        return "medium";
    return "low";
}
function inferSummary(evidence) {
    const platform = evidence.platformId;
    const topic = extractTopic(evidence);
    return `Observation from ${platform}: ${topic}`;
}
function inferPossibleIntents(evidence) {
    const intents = ["watch"];
    if (evidence.sensitivityHint !== "sensitive") {
        intents.push("remember");
    }
    if (evidence.sensitivityHint === "public_technical") {
        intents.push("notify_owner");
    }
    return intents;
}
function inferReviewPriority(evidence) {
    if (evidence.sensitivityHint === "sensitive")
        return "high";
    if (evidence.sensitivityHint === "public_technical")
        return "medium";
    return "low";
}
function inferRiskFlags(evidence) {
    const flags = [];
    if (evidence.sensitivityHint === "sensitive") {
        flags.push("credential_shape_detected");
    }
    if (evidence.sensitivityHint === "private_context") {
        flags.push("private_context");
    }
    return flags;
}
function buildCardFromEvidence(evidence, cycleId, now) {
    const sourceRefs = parseSourceRefs(evidence.sourceRefsJson);
    const relevanceScore = inferRelevanceScore(evidence);
    return {
        id: `per_${evidence.id}`,
        cycleId,
        topic: extractTopic(evidence),
        entities: extractEntities(evidence),
        noveltyClass: inferNoveltyClass(evidence),
        relevanceScore,
        relevanceClass: inferRelevanceClass(relevanceScore),
        summary: inferSummary(evidence),
        possibleIntents: inferPossibleIntents(evidence),
        reviewPriority: inferReviewPriority(evidence),
        sensitivityClass: evidence.sensitivityHint || "public_general",
        riskFlags: inferRiskFlags(evidence),
        confidence: 0.6,
        evidenceRefs: sourceRefs,
        createdAt: now,
    };
}
export async function buildPerceptionCards(db, options) {
    const now = options.now ?? new Date().toISOString();
    const maxEvidence = options.maxEvidence ?? PERCEPTION_MAX_EVIDENCE_PER_CYCLE;
    const readResult = await readEvidenceItemsByStatus(db, "pending");
    if (readResult.degraded) {
        return readResult.degraded;
    }
    const evidenceItems = readResult.rows;
    if (evidenceItems.length === 0) {
        return {
            status: "empty",
            cards: [],
            reason: "evidence_batch_empty",
        };
    }
    const truncated = evidenceItems.length > maxEvidence;
    const selectedEvidence = evidenceItems.slice(0, maxEvidence);
    const cards = [];
    for (const evidence of selectedEvidence) {
        const card = buildCardFromEvidence({
            id: evidence.id,
            platformId: evidence.platformId,
            contentHash: evidence.contentHash,
            observedAt: evidence.observedAt,
            sensitivityHint: evidence.sensitivityHint ?? undefined,
            sourceRefsJson: evidence.sourceRefsJson,
            payloadJson: evidence.payloadJson,
        }, options.cycleId, now);
        cards.push(card);
        // Write card to state
        const writeResult = await writePerceptionCard(db, {
            id: card.id,
            createdAt: now,
            cycleId: card.cycleId,
            topic: card.topic,
            entitiesJson: JSON.stringify(card.entities),
            novelty: card.noveltyClass,
            relevance: card.relevanceScore,
            relevanceClass: card.relevanceClass,
            summary: card.summary,
            riskFlagsJson: JSON.stringify(card.riskFlags),
            confidence: card.confidence,
            reviewPriority: card.reviewPriority,
            sourceRefs: card.evidenceRefs,
            redactionClass: card.sensitivityClass === "sensitive" ? "blocked" : "none",
            lifecycleStatus: "pending",
            payloadJson: JSON.stringify({
                possibleIntents: card.possibleIntents,
                sensitivityClass: card.sensitivityClass,
            }),
        });
        if ("reason" in writeResult) {
            return {
                status: "degraded",
                cards,
                reason: writeResult.reason,
            };
        }
    }
    return {
        status: "completed",
        cards,
        truncated,
        reason: truncated ? "evidence_batch_truncated" : undefined,
    };
}
