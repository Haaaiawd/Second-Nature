/**
 * NormalizedEvidenceContent — Cross-platform content-bearing evidence envelope.
 *
 * Core logic: Map arbitrary connector read payloads into a stable, source-backed
 * summary structure that perception, Quiet, and Dream can consume. This is a
 * schema boundary, not a judgment layer.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/connector-system.md`
 * - `.anws/v8/04_SYSTEM_DESIGN/perception-judgment-system.md`
 *
 * Dependencies:
 * - none (pure extraction)
 *
 * Boundary:
 * - Does not classify sensitivity.
 * - Does not redact; callers run redaction separately.
 * - Does not persist; callers write EvidenceItem.
 * - Preserves raw values in canonicalText/excerpt so downstream can decide what to keep.
 *
 * Test coverage: tests/unit/connectors/normalized-evidence-content.test.ts
 */
export declare const NORMALIZED_EVIDENCE_SCHEMA_VERSION = 1;
export type EvidenceSourceKind = "post" | "comment" | "profile" | "task" | "event" | "game_state" | "notification" | "document" | "unknown";
export type SummaryProducer = "connector_rules" | "model_assist" | "operator_supplied";
export interface EvidenceActor {
    id?: string;
    displayName?: string;
    role?: string;
}
export interface NormalizedEvidenceContent {
    schemaVersion: typeof NORMALIZED_EVIDENCE_SCHEMA_VERSION;
    sourceKind: EvidenceSourceKind;
    platformId: string;
    capabilityId: string;
    externalId?: string;
    title?: string;
    summary: string;
    excerpt?: string;
    canonicalText?: string;
    actor?: EvidenceActor;
    url?: string;
    occurredAt?: string;
    observedAt: string;
    tags?: string[];
    entities?: string[];
    metrics?: Record<string, number | string | boolean>;
    rawContentRef?: string;
    summaryProducer: SummaryProducer;
}
export interface ExtractEvidenceOptions {
    platformId: string;
    capabilityId: string;
    observedAt?: string;
    summaryProducer?: SummaryProducer;
    /** Max characters for excerpt. Default 240. */
    excerptMaxChars?: number;
    /** Max characters for canonicalText. Default 2000. */
    canonicalTextMaxChars?: number;
}
/**
 * Extract a list of content-bearing evidence items from a connector success payload.
 * Returns empty array when data is not an object/array or contains no extractable items.
 */
export declare function extractNormalizedEvidenceItems(data: unknown, options: ExtractEvidenceOptions): NormalizedEvidenceContent[];
/**
 * Compute a stable content hash for deduplication across connector runs.
 * Prefer externalId-based identity; this hash is the fallback.
 */
export declare function computeEvidenceContentHash(content: NormalizedEvidenceContent): string;
export declare function computeEvidenceContentHashSync(content: NormalizedEvidenceContent): string;
