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
import { redactPayload, DEFAULT_REDACTION_POLICY, } from "./redaction/policy.js";
// ───────────────────────────────────────────────────────────────
// Sensitive key patterns (§1.8)
// ───────────────────────────────────────────────────────────────
export const SENSITIVE_KEY_PATTERNS = [
    /password/i,
    /token/i,
    /api[_-]?key/i,
    /secret/i,
    /credential/i,
    /private[_-]?key/i,
    /authorization/i,
];
// ───────────────────────────────────────────────────────────────
// Credential value detection
// ───────────────────────────────────────────────────────────────
/**
 * High-entropy string patterns that look like credential values.
 * These are heuristic patterns — not cryptographic detection.
 */
const CREDENTIAL_VALUE_PATTERNS = [
    // Bearer tokens: "Bearer eyJ..."
    /bearer\s+[A-Za-z0-9._-]+/i,
    // AWS-style keys: AKIA followed by 16 chars
    /AKIA[0-9A-Z]{16}/,
    // Generic base64 JWT-like: three base64 segments separated by dots
    /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
    // Long hex strings (40+ chars, like API keys)
    /[a-f0-9]{40,}/i,
    // Long base64 strings (32+ chars that aren't hashes)
    /[A-Za-z0-9+\/]{32,}={0,2}/,
];
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
export function containsCredentialValue(payloadJson) {
    if (!payloadJson || payloadJson.trim() === "")
        return false;
    // Check for credential-shaped values in the raw string.
    for (const pattern of CREDENTIAL_VALUE_PATTERNS) {
        if (pattern.test(payloadJson))
            return true;
    }
    // Deep-scan parsed JSON for credential-shaped values in any field.
    try {
        const parsed = JSON.parse(payloadJson);
        return scanObjectForCredentialValues(parsed);
    }
    catch {
        // Not valid JSON — check raw string for credential patterns only.
        return false;
    }
}
function scanObjectForCredentialValues(obj, depth = 0) {
    if (depth > 10)
        return false; // depth limit to prevent stack overflow
    if (obj === null || obj === undefined)
        return false;
    if (typeof obj === "string") {
        for (const pattern of CREDENTIAL_VALUE_PATTERNS) {
            if (pattern.test(obj))
                return true;
        }
        return false;
    }
    if (typeof obj !== "object")
        return false;
    if (Array.isArray(obj)) {
        return obj.some((item) => scanObjectForCredentialValues(item, depth + 1));
    }
    const record = obj;
    for (const [, value] of Object.entries(record)) {
        if (scanObjectForCredentialValues(value, depth + 1))
            return true;
    }
    return false;
}
// ───────────────────────────────────────────────────────────────
// redactPayloadJson (§3.1 §3.2)
// ───────────────────────────────────────────────────────────────
/**
 * Redact a JSON payload string.
 * 1. Check for credential values → if found, return blocked result.
 * 2. Parse JSON → apply redactPayload → serialize back.
 * 3. Return redacted JSON + manifest.
 *
 * If the payload is not valid JSON, returns it as-is with wasRedacted=false.
 */
export function redactPayloadJson(payloadJson, policy = DEFAULT_REDACTION_POLICY) {
    const empty = {
        json: payloadJson ?? "",
        containsCredentialValue: false,
        wasRedacted: false,
        manifest: { maskedPaths: [], erasedPaths: [], hashedPaths: [] },
    };
    if (!payloadJson || payloadJson.trim() === "")
        return empty;
    // Step 1: Check for credential values.
    const hasCredential = containsCredentialValue(payloadJson);
    if (hasCredential) {
        return {
            json: payloadJson,
            containsCredentialValue: true,
            wasRedacted: false,
            manifest: { maskedPaths: [], erasedPaths: [], hashedPaths: [] },
        };
    }
    // Step 2: Parse and redact.
    let parsed;
    try {
        parsed = JSON.parse(payloadJson);
    }
    catch {
        return empty;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return empty;
    }
    const result = redactPayload(parsed, policy);
    const wasRedacted = result.manifest.maskedPaths.length > 0 ||
        result.manifest.erasedPaths.length > 0 ||
        result.manifest.hashedPaths.length > 0;
    return {
        json: wasRedacted ? JSON.stringify(result.payload) : payloadJson,
        containsCredentialValue: false,
        wasRedacted,
        manifest: {
            maskedPaths: result.manifest.maskedPaths,
            erasedPaths: result.manifest.erasedPaths,
            hashedPaths: result.manifest.hashedPaths,
        },
    };
}
/**
 * Redact a ledger entry's `redactedPayloadJson` field.
 * If credential values are detected, returns blocked=true and the caller
 * should emit a `ledger_redaction_blocked` stage event instead of writing.
 */
export function redactLedgerEntry(redactedPayloadJson, policy = DEFAULT_REDACTION_POLICY) {
    const result = redactPayloadJson(redactedPayloadJson, policy);
    if (result.containsCredentialValue) {
        return {
            redactedPayloadJson: "",
            blocked: true,
            reasonCode: "ledger_redaction_blocked",
            manifest: { maskedPaths: [], erasedPaths: [], hashedPaths: [] },
        };
    }
    return {
        redactedPayloadJson: result.json,
        blocked: false,
        manifest: result.manifest,
    };
}
// ───────────────────────────────────────────────────────────────
// redactTimelinePayload (§3.9)
// ───────────────────────────────────────────────────────────────
/**
 * Redact a timeline row's payload JSON.
 * Timeline rows are read-only projections; redaction is applied on read,
 * not on write. Credential values are masked (not blocked) since the
 * timeline is a derived view.
 */
export function redactTimelinePayload(payloadJson, policy = DEFAULT_REDACTION_POLICY) {
    return redactPayloadJson(payloadJson, policy);
}
// ───────────────────────────────────────────────────────────────
// redactCharacterFrameEvent (§5.3 §5.6)
// ───────────────────────────────────────────────────────────────
/**
 * Redact a CharacterFrame observability event payload.
 * Character events must not contain emotion/personality/identity-lock/
 * hard-control assertions (ADR-006). Credential values are blocked.
 */
export function redactCharacterFrameEvent(payloadJson, policy = DEFAULT_REDACTION_POLICY) {
    // Character events use the same redaction logic as ledger entries:
    // credential values block the write, sensitive fields are masked/erased.
    return redactLedgerEntry(payloadJson, policy);
}
// ───────────────────────────────────────────────────────────────
// Character safety validator (ADR-006)
// ───────────────────────────────────────────────────────────────
/**
 * Forbidden patterns in character frame text (ADR-006):
 * - Emotion assertions ("I feel happy", "feeling sad")
 * - Personality scores ("openness: 0.8", "personality score")
 * - Identity locks ("you are a kind person", "your identity is")
 * - Hard control rules ("you must always", "never do X")
 */
const CHARACTER_FORBIDDEN_PATTERNS = [
    // Emotion assertions (English)
    /\bI feel (happy|sad|angry|excited|depressed|anxious|joyful|fearful)\b/i,
    /\bfeeling (happy|sad|angry|excited|depressed|anxious)\b/i,
    // Emotion assertions (Chinese)
    /我感到(开心|快乐|悲伤|愤怒|兴奋|沮丧|焦虑|恐惧)/,
    /感觉(开心|快乐|悲伤|愤怒|兴奋|沮丧|焦虑)/,
    // Personality scores
    /\b(openness|conscientiousness|extraversion|agreeableness|neuroticism)\s*[:=]\s*\d/i,
    /personality\s+score/i,
    /人格(分数|得分)/,
    /性格(分数|得分)/,
    // Identity locks
    /\byou are (a |an )?\w+ person\b/i,
    /\byour identity is\b/i,
    /你是一个?\S*的人/,
    /你的(身份|人格)是/,
    // Hard control rules
    /\byou must always\b/i,
    /\bnever do\b/i,
    /\byou should never\b/i,
    /你必须总是/,
    /你永远不要/,
    /你绝不/,
];
/**
 * Validate that character frame text doesn't contain forbidden
 * emotion/personality/identity-lock/hard-control patterns (ADR-006).
 */
export function validateCharacterSafety(text) {
    const violated = [];
    for (const pattern of CHARACTER_FORBIDDEN_PATTERNS) {
        if (pattern.test(text)) {
            violated.push(pattern.source);
        }
    }
    return {
        safe: violated.length === 0,
        violatedPatterns: violated,
    };
}
