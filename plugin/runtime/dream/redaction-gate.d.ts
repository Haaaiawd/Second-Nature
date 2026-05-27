/**
 * Dream redaction gate.
 *
 * Core logic: before sending evidence to LLM, strip credential-like fields,
 * PII patterns, and sensitive platform payload. If redaction fails or
 * sensitivity is too high, block the LLM stage and record reason.
 * Test coverage: tests/integration/dream/t7-1-1-dream-pipeline.test.ts
 */
import type { RedactedEvidenceBundle } from "./types.js";
export interface RedactionInput {
    evidenceSummaries: string[];
    chronicleSummaries: string[];
    activeMemorySummaries?: string[];
    sensitivityFlags?: string[];
}
export interface RedactionResult {
    allowed: boolean;
    redactedEvidence: string[];
    redactedChronicle: string[];
    redactedMemory: string[];
    blockedReason?: string;
    credentialHits: number;
    piiHits: number;
}
/**
 * Produce a RedactedEvidenceBundle brand type (DR-027).
 * Must be called before passing evidence to ModelAssistPort.
 * Returns null if redaction gate blocks the bundle.
 */
export declare function redactBundle(evidence: string[], chronicle: string[], memory?: string[]): RedactedEvidenceBundle | null;
export declare function redactDreamInput(input: RedactionInput): RedactionResult;
