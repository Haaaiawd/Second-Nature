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
import type { StateDatabase } from "../../../storage/db/index.js";
import type { SourceRef, DegradedOperationResult, PlatformNeutralActionKind, V8ReasonCode } from "../../../shared/types/v8-contracts.js";
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
}
export interface BuildPerceptionCardsResult {
    status: "completed" | "rules_only" | "blocked" | "empty" | "degraded";
    cards: PerceptionCardResult[];
    reason?: V8ReasonCode;
    truncated?: boolean;
}
export interface BuildPerceptionCardsOptions {
    cycleId: string;
    maxEvidence?: number;
    now?: string;
}
export declare function buildPerceptionCards(db: StateDatabase, options: BuildPerceptionCardsOptions): Promise<BuildPerceptionCardsResult | DegradedOperationResult>;
