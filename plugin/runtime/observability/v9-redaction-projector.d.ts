/**
 * v9 Redaction Projector (T8.1.2).
 *
 * Extends v8 redaction to cover v9 ledger payloads, timeline payloads,
 * and CharacterFrame events. Detects credential-shaped values and blocks
 * writes when credential values are found.
 *
 * Core logic:
 * - `redactPayloadJson`: scan JSON payload string for sensitive keys,
 *   mask/erase/hash values, return redacted JSON + manifest.
 * - `containsCredentialValue`: detect if payload contains credential-shaped
 *   field values (not just keys — also scans for high-entropy strings that
 *   look like API keys/tokens).
 * - `redactLedgerEntry`: apply redaction to ledger `redactedPayloadJson`,
 *   return blocked result if credential value detected.
 * - `redactTimelinePayload`: apply redaction to timeline row payloads.
 * - `redactCharacterFrameEvent`: apply redaction to character frame events.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/observability-recovery-system.detail.md §1.8 §3.2 §4.2 §5.3`
 * - PRD §6.2, ADR-006
 *
 * Dependencies:
 * - `src/observability/redaction/policy.js` (v8 redaction policy + redactPayload)
 *
 * Boundary:
 * - Pure functions; no DB access, no filesystem, no network.
 * - Credential detection is pattern-based, not cryptographic.
 * - Does NOT modify the original payload; returns a new redacted copy.
 *
 * Test coverage: `tests/unit/observability/v9-redaction-projector.test.ts`
 */
import { type RedactionPolicy } from "./redaction/policy.js";
export declare const SENSITIVE_KEY_PATTERNS: readonly [RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp];
/**
 * Check if a JSON string payload contains credential-shaped values.
 * Only detects values that match credential patterns (JWT, AWS keys,
 * long hex/base64 strings). Sensitive keys with non-credential values
 * (e.g. `token: "short"`) are NOT blocked — they are masked by the
 * redaction policy instead.
 *
 * Returns true if credential-shaped values are detected — the caller
 * should block the write.
 */
export declare function containsCredentialValue(payloadJson: string): boolean;
export interface V9RedactionResult {
    /** Redacted JSON string (structure-preserving). */
    json: string;
    /** True if credential values were detected — write should be blocked. */
    containsCredentialValue: boolean;
    /** True if any fields were masked/erased/hashed. */
    wasRedacted: boolean;
    /** Manifest of redacted paths. */
    manifest: {
        maskedPaths: string[];
        erasedPaths: string[];
        hashedPaths: string[];
    };
}
/**
 * Redact a JSON payload string.
 * 1. Check for credential values → if found, return blocked result.
 * 2. Parse JSON → apply redactPayload → serialize back.
 * 3. Return redacted JSON + manifest.
 *
 * If the payload is not valid JSON, returns it as-is with wasRedacted=false.
 */
export declare function redactPayloadJson(payloadJson: string | undefined | null, policy?: RedactionPolicy): V9RedactionResult;
export interface LedgerRedactionResult {
    /** Redacted payload JSON, safe to persist. */
    redactedPayloadJson: string;
    /** True if credential value detected — write must be blocked. */
    blocked: boolean;
    /** Reason code for blocking. */
    reasonCode?: string;
    /** Manifest of redacted paths. */
    manifest: {
        maskedPaths: string[];
        erasedPaths: string[];
        hashedPaths: string[];
    };
}
/**
 * Redact a ledger entry's `redactedPayloadJson` field.
 * If credential values are detected, returns blocked=true and the caller
 * should emit a `ledger_redaction_blocked` stage event instead of writing.
 */
export declare function redactLedgerEntry(redactedPayloadJson: string | undefined | null, policy?: RedactionPolicy): LedgerRedactionResult;
/**
 * Redact a timeline row's payload JSON.
 * Timeline rows are read-only projections; redaction is applied on read,
 * not on write. Credential values are masked (not blocked) since the
 * timeline is a derived view.
 */
export declare function redactTimelinePayload(payloadJson: string | undefined | null, policy?: RedactionPolicy): V9RedactionResult;
/**
 * Redact a CharacterFrame observability event payload.
 * Character events must not contain emotion/personality/identity-lock/
 * hard-control assertions (ADR-006). Credential values are blocked.
 */
export declare function redactCharacterFrameEvent(payloadJson: string | undefined | null, policy?: RedactionPolicy): LedgerRedactionResult;
export interface CharacterSafetyResult {
    safe: boolean;
    violatedPatterns: string[];
}
/**
 * Validate that character frame text doesn't contain forbidden
 * emotion/personality/identity-lock/hard-control patterns (ADR-006).
 */
export declare function validateCharacterSafety(text: string): CharacterSafetyResult;
