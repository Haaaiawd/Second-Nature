/**
 * SensitivityClassifier — v8 context-aware sensitivity classifier.
 *
 * Core logic: Classify evidence text as public_technical, public_general,
 * private_context, or sensitive using field context, source context,
 * value shape, and entropy signals.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/perception-judgment-system.detail.md §3.2`
 * - `.anws/v8/04_SYSTEM_DESIGN/perception-judgment-system.detail.md §4.1`
 *
 * Dependencies:
 * - `src/shared/types/v8-contracts.js` (SensitivityClass)
 *
 * Boundary:
 * - Pure function; no DB access, no side effects.
 * - Does not block on classification; returns degraded only on malformed input.
 * - Technical vocabulary alone does not trigger sensitive.
 *
 * Test coverage: tests/unit/perception/sensitivity-classifier.test.ts
 */
import type { SensitivityClass } from "../../../shared/types/v8-contracts.js";
export interface SensitivityClassification {
    sensitivityClass: SensitivityClass;
    confidence: number;
    reason: string;
    flags: string[];
}
export declare function classifyEvidenceSensitivity(text: string, sourceContext?: string): SensitivityClassification;
export interface BatchClassificationResult {
    classifications: SensitivityClassification[];
    sensitiveCount: number;
    privateCount: number;
    publicTechnicalCount: number;
    publicGeneralCount: number;
}
export declare function classifyEvidenceBatch(texts: string[], sourceContexts?: string[]): BatchClassificationResult;
