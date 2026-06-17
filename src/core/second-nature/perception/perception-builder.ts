/**
 * PerceptionBuilder — Generate PerceptionCard records from EvidenceItem batches.
 *
 * Core logic: Read pending evidence, deduplicate by externalId/content hash, build
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

import type { StateDatabase } from "../../../storage/db/index.js";
import {
  readEvidenceItemsByStatus,
  writePerceptionCard,
  updateEvidenceItemLifecycleStatus,
} from "../../../storage/v8-state-stores.js";
import { parseSourceRefs } from "../../../shared/serialization.js";
import type {
  SourceRef,
  DegradedOperationResult,
  PlatformNeutralActionKind,
  V8ReasonCode,
} from "../../../shared/types/v8-contracts.js";
import type { NormalizedEvidenceContent } from "../../../connectors/base/normalized-evidence-content.js";

// ───────────────────────────────────────────────────────────────
// Config
// ───────────────────────────────────────────────────────────────

const PERCEPTION_MAX_EVIDENCE_PER_CYCLE = 50;

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

export interface EvidenceItemInput {
  id: string;
  platformId: string;
  contentHash: string;
  observedAt: string;
  sensitivityHint?: string;
  sourceRefsJson: string;
  payloadJson?: string | null;
}

export interface PerceptionCardResult {
  id: string;
  cycleId: string;
  topic: string;
  entities: string[];
  /** Canonical novelty class: new | changed | duplicate | stale */
  noveltyClass: "new" | "changed" | "duplicate" | "stale";
  /** Numeric relevance score in [0, 1] */
  relevanceScore: number;
  /** Derived relevance class: low | medium | high */
  relevanceClass: "low" | "medium" | "high";
  summary: string;
  possibleIntents: PlatformNeutralActionKind[];
  reviewPriority: "low" | "medium" | "high";
  sensitivityClass: string;
  riskFlags: string[];
  confidence: number;
  evidenceRefs: SourceRef[];
  createdAt: string;
  /** True when the evidence payload lacked readable content and only refs are present. */
  contentMissing?: boolean;
}

export interface BuildPerceptionCardsResult {
  status: "completed" | "rules_only" | "blocked" | "empty" | "degraded";
  cards: PerceptionCardResult[];
  reason?: V8ReasonCode;
  truncated?: boolean;
}

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

function parsePayload(json: string | null | undefined): NormalizedEvidenceContent | undefined {
  if (!json) return undefined;
  try {
    const parsed = JSON.parse(json) as unknown;
    if (parsed && typeof parsed === "object" && "schemaVersion" in parsed) {
      return parsed as NormalizedEvidenceContent;
    }
    if (parsed && typeof parsed === "object" && "summary" in parsed) {
      // Legacy payload or direct summary object
      return {
        schemaVersion: 1,
        sourceKind: "unknown",
        platformId: "",
        capabilityId: "",
        summary: String((parsed as Record<string, unknown>).summary ?? ""),
        observedAt: new Date().toISOString(),
        summaryProducer: "connector_rules",
        ...(parsed as Record<string, unknown>),
      } as NormalizedEvidenceContent;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

function extractTopic(evidence: EvidenceItemInput): string {
  const payload = parsePayload(evidence.payloadJson);
  if (payload?.title) return String(payload.title);
  if (payload?.summary) {
    const summary = String(payload.summary);
    return summary.length > 60 ? `${summary.slice(0, 60)}…` : summary;
  }
  return `${evidence.platformId}_observation`;
}

function extractEntities(evidence: EvidenceItemInput): string[] {
  const entities: string[] = [evidence.platformId];
  const payload = parsePayload(evidence.payloadJson);
  if (payload?.entities && Array.isArray(payload.entities)) {
    entities.push(...payload.entities.map(String));
  }
  if (payload?.tags && Array.isArray(payload.tags)) {
    entities.push(...payload.tags.map(String));
  }
  if (payload?.actor?.displayName) {
    entities.push(payload.actor.displayName);
  }
  return [...new Set(entities.filter((e) => e.length > 0))];
}

function inferNoveltyClass(
  evidence: EvidenceItemInput,
  duplicateKey: string,
  seenKeys: Map<string, string>,
): PerceptionCardResult["noveltyClass"] {
  if (seenKeys.has(duplicateKey)) {
    const firstObserved = seenKeys.get(duplicateKey)!;
    const current = evidence.observedAt;
    // If same calendar day, treat as duplicate; otherwise stale.
    return firstObserved.slice(0, 10) === current.slice(0, 10) ? "duplicate" : "stale";
  }
  if (evidence.sensitivityHint === "public_technical") return "changed";
  return "new";
}

function inferRelevanceScore(evidence: EvidenceItemInput): number {
  if (evidence.sensitivityHint === "sensitive") return 0.9;
  if (evidence.sensitivityHint === "public_technical") return 0.7;
  if (evidence.sensitivityHint === "private_context") return 0.5;
  return 0.3;
}

function inferRelevanceClass(score: number): PerceptionCardResult["relevanceClass"] {
  if (score >= 0.7) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}

function inferSummary(evidence: EvidenceItemInput): { summary: string; contentMissing: boolean } {
  const payload = parsePayload(evidence.payloadJson);
  if (payload?.summary && String(payload.summary).trim().length > 0) {
    return { summary: String(payload.summary), contentMissing: false };
  }
  if (payload?.title) {
    return { summary: `Observation from ${evidence.platformId}: ${payload.title}`, contentMissing: false };
  }
  return {
    summary: `Ref-only observation from ${evidence.platformId}: no readable content`,
    contentMissing: true,
  };
}

function inferPossibleIntents(evidence: EvidenceItemInput): PlatformNeutralActionKind[] {
  const intents: PlatformNeutralActionKind[] = ["watch"];
  if (evidence.sensitivityHint !== "sensitive") {
    intents.push("remember");
  }
  if (evidence.sensitivityHint === "public_technical") {
    intents.push("notify_owner");
  }
  return intents;
}

function inferReviewPriority(evidence: EvidenceItemInput): PerceptionCardResult["reviewPriority"] {
  if (evidence.sensitivityHint === "sensitive") return "high";
  if (evidence.sensitivityHint === "public_technical") return "medium";
  return "low";
}

function inferRiskFlags(evidence: EvidenceItemInput): string[] {
  const flags: string[] = [];
  if (evidence.sensitivityHint === "sensitive") {
    flags.push("credential_shape_detected");
  }
  if (evidence.sensitivityHint === "private_context") {
    flags.push("private_context");
  }
  return flags;
}

function duplicateKey(evidence: EvidenceItemInput): string {
  const payload = parsePayload(evidence.payloadJson);
  if (payload?.externalId) {
    return `${evidence.platformId}:${evidence.contentHash}:${payload.externalId}`;
  }
  return `${evidence.platformId}:${evidence.contentHash}`;
}

function buildCardFromEvidence(
  evidence: EvidenceItemInput,
  cycleId: string,
  now: string,
  seenKeys: Map<string, string>,
): PerceptionCardResult {
  const sourceRefs = parseSourceRefs(evidence.sourceRefsJson);
  const relevanceScore = inferRelevanceScore(evidence);
  const key = duplicateKey(evidence);
  const { summary, contentMissing } = inferSummary(evidence);
  return {
    id: `per_${evidence.id}`,
    cycleId,
    topic: extractTopic(evidence),
    entities: extractEntities(evidence),
    noveltyClass: inferNoveltyClass(evidence, key, seenKeys),
    relevanceScore,
    relevanceClass: inferRelevanceClass(relevanceScore),
    summary,
    possibleIntents: inferPossibleIntents(evidence),
    reviewPriority: inferReviewPriority(evidence),
    sensitivityClass: evidence.sensitivityHint || "public_general",
    riskFlags: inferRiskFlags(evidence),
    confidence: contentMissing ? 0.3 : 0.6,
    evidenceRefs: sourceRefs,
    createdAt: now,
    contentMissing,
  };
}

// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────

export interface BuildPerceptionCardsOptions {
  cycleId: string;
  maxEvidence?: number;
  now?: string;
}

export async function buildPerceptionCards(
  db: StateDatabase,
  options: BuildPerceptionCardsOptions,
): Promise<BuildPerceptionCardsResult | DegradedOperationResult> {
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

  const cards: PerceptionCardResult[] = [];
  const seenKeys = new Map<string, string>();

  for (const evidence of selectedEvidence) {
    const card = buildCardFromEvidence(
      {
        id: evidence.id,
        platformId: evidence.platformId,
        contentHash: evidence.contentHash,
        observedAt: evidence.observedAt,
        sensitivityHint: evidence.sensitivityHint ?? undefined,
        sourceRefsJson: evidence.sourceRefsJson,
        payloadJson: evidence.payloadJson,
      },
      options.cycleId,
      now,
      seenKeys,
    );

    cards.push(card);

    // Track first observation timestamp for duplicate/stale classification
    const key = duplicateKey({
      id: evidence.id,
      platformId: evidence.platformId,
      contentHash: evidence.contentHash,
      observedAt: evidence.observedAt,
      sourceRefsJson: evidence.sourceRefsJson,
      payloadJson: evidence.payloadJson,
    });
    if (!seenKeys.has(key)) {
      seenKeys.set(key, evidence.observedAt);
    }

    // Write card to state and advance evidence lifecycle
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
        contentMissing: card.contentMissing,
      }),
    });

    if ("reason" in writeResult) {
      return {
        status: "degraded",
        cards,
        reason: writeResult.reason,
      };
    }

    await updateEvidenceItemLifecycleStatus(db, evidence.id, "perceived");
  }

  const hasContentMissing = cards.some((c) => c.contentMissing);
  const allContentMissing = cards.length > 0 && cards.every((c) => c.contentMissing);
  const status: BuildPerceptionCardsResult["status"] = allContentMissing ? "rules_only" : "completed";

  return {
    status,
    cards,
    truncated,
    reason: status === "rules_only" ? "evidence_content_missing" : (truncated ? "evidence_batch_truncated" : undefined),
  };
}
