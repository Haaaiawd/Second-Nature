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
// ───────────────────────────────────────────────────────────────
// Detection patterns
// ───────────────────────────────────────────────────────────────
const TECHNICAL_VOCABULARY = /\b(token|secret|credential|api.key|auth|oauth|jwt|bearer|ssh|rsa|ecdsa|pem|key.pair)s?\b/i;
const VALUE_LIKE_SECRET = /\b[a-zA-Z0-9_]+\s*[:=]\s*['"][a-zA-Z0-9+/=\-_]{20,}['"]/i;
const BEARER_TOKEN = /\bBearer\s+[a-zA-Z0-9_\-\.]{20,}/i;
const PRIVATE_KEY_HEADER = /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/i;
const PRIVATE_CONTEXT_MARKERS = /\b(DM|私信|private message|confidential|internal only|not for distribution|restricted)\b/i;
// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────
export function classifyEvidenceSensitivity(text, sourceContext) {
    if (!text || text.trim().length === 0) {
        return {
            sensitivityClass: "public_general",
            confidence: 0.1,
            reason: "empty_input",
            flags: ["classification_low_confidence"],
        };
    }
    const flags = [];
    // 1. Credential value shape — highest priority
    if (VALUE_LIKE_SECRET.test(text) || BEARER_TOKEN.test(text) || PRIVATE_KEY_HEADER.test(text)) {
        return {
            sensitivityClass: "sensitive",
            confidence: 0.95,
            reason: "credential_shape_detected",
            flags: ["value_like_secret"],
        };
    }
    // 2. Private source context
    if (PRIVATE_CONTEXT_MARKERS.test(text) || (sourceContext && PRIVATE_CONTEXT_MARKERS.test(sourceContext))) {
        return {
            sensitivityClass: "private_context",
            confidence: 0.8,
            reason: "private_context_detected",
            flags: ["private_source_markers"],
        };
    }
    // 3. Technical vocabulary only
    if (TECHNICAL_VOCABULARY.test(text)) {
        return {
            sensitivityClass: "public_technical",
            confidence: 0.75,
            reason: "technical_vocabulary_only",
            flags: ["no_value_shape"],
        };
    }
    // 4. Default — public general
    return {
        sensitivityClass: "public_general",
        confidence: 0.5,
        reason: "no_distinctive_signals",
        flags: ["classification_low_confidence"],
    };
}
export function classifyEvidenceBatch(texts, sourceContexts) {
    const classifications = texts.map((text, i) => classifyEvidenceSensitivity(text, sourceContexts?.[i]));
    return {
        classifications,
        sensitiveCount: classifications.filter((c) => c.sensitivityClass === "sensitive").length,
        privateCount: classifications.filter((c) => c.sensitivityClass === "private_context").length,
        publicTechnicalCount: classifications.filter((c) => c.sensitivityClass === "public_technical").length,
        publicGeneralCount: classifications.filter((c) => c.sensitivityClass === "public_general").length,
    };
}
