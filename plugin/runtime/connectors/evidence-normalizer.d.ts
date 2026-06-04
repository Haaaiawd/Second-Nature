/**
 * EvidenceNormalizer — Convert connector read results into v8 EvidenceItems.
 *
 * Core logic: Map successful read-type ConnectorResult payloads into
 * deduplicated EvidenceItem rows with structured SourceRef, content hash,
 * platform id, observedAt, and sensitivity hint.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/connector-system.md`
 * - `.anws/v8/02_ARCHITECTURE_OVERVIEW.md §System 7`
 *
 * Dependencies:
 * - `src/shared/types/v8-contracts.js` (SourceRef, V8ReasonCode)
 * - `src/storage/v8-state-stores.js` (writeEvidenceItem)
 *
 * Boundary:
 * - Does not judge evidence importance.
 * - Does not fabricate evidence on empty or failed connector results.
 * - Deduplicates by content hash within a single normalization run.
 *
 * Test coverage: tests/unit/connectors/evidence-normalizer.test.ts
 */
import type { StateDatabase } from "../storage/db/index.js";
import type { DegradedOperationResult, V8ReasonCode, SensitivityClass } from "../shared/types/v8-contracts.js";
export interface ConnectorReadResult {
    status: "success" | "failed" | "unavailable" | "timeout";
    platformId: string;
    capabilityId: string;
    items: ConnectorReadItem[];
    observedAt?: string;
    failureReason?: V8ReasonCode;
}
export interface ConnectorReadItem {
    id?: string;
    content: string;
    platformRef?: string;
    sensitivityHint?: SensitivityClass;
    metadata?: Record<string, unknown>;
}
export interface EvidenceNormalizationResult {
    evidenceIds: string[];
    emptyReason?: V8ReasonCode;
    degraded?: DegradedOperationResult;
}
export declare function normalizeConnectorEvidence(db: StateDatabase, result: ConnectorReadResult, now?: string): Promise<EvidenceNormalizationResult>;
