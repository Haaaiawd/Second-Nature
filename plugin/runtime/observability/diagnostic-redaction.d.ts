/**
 * DiagnosticRedaction — Attribute sensitivity blocks and redact diagnostics.
 *
 * Core logic: Given a diagnostic payload, classify its sensitivity,
 * redact credential-shaped values, preserve public technical summaries,
 * and attribute the block to the responsible system.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/observability-health-system.detail.md §3.4`
 * - `.anws/v8/04_SYSTEM_DESIGN/observability-health-system.md §5`
 *
 * Dependencies:
 * - `src/shared/types/v8-contracts.js` (SourceRef, RedactionClass, SensitivityClass)
 *
 * Boundary:
 * - Pure function; no DB access.
 * - Does not modify source data; returns redacted copy.
 * - Public technical vocabulary is preserved.
 *
 * Test coverage: tests/unit/observability/diagnostic-redaction.test.ts
 */
import type { RedactionClass, SensitivityClass, V8ReasonCode } from "../shared/types/v8-contracts.js";
export interface DiagnosticPayload {
    summary: string;
    detail?: string;
    sourceSystem: "perception" | "judgment" | "dream" | "policy" | "storage" | "unknown";
    sensitivityHint?: SensitivityClass;
    reasonCode?: V8ReasonCode;
}
export interface RedactedDiagnostic {
    summary: string;
    detail?: string;
    redactionClass: RedactionClass;
    attribution: string;
}
export type DiagnosticAttribution = "storage_validation_block" | "dream_redaction_block" | "perception_risk_block" | "policy_denial" | "credential_shape_detected" | "private_context" | "public_technical_preserved" | "no_redaction_needed";
/**
 * Classify sensitivity-related diagnostic attribution based on source system
 * and reason code. Maps to deterministic attribution categories per
 * observability-health-system.detail.md §4.2.
 */
export declare function classifyDiagnosticAttribution(sourceSystem: DiagnosticPayload["sourceSystem"], reasonCode?: V8ReasonCode): DiagnosticAttribution;
export declare function projectDiagnosticRedaction(payload: DiagnosticPayload): RedactedDiagnostic;
