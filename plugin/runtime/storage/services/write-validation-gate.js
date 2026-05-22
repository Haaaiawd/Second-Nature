/**
 * WriteValidationGate — T-SMS.C.1
 *
 * Core logic: All write paths MUST pass through this gate before persisting.
 * Rejects payloads containing sensitive fields, missing source refs on fact
 * claims, or failing schema/sensitivity scans. Returns structured machine-
 * readable reason codes (DR-022).
 *
 * Dependencies:
 * - `SourceRef` type from `../../shared/types/source-ref.js`
 * - v7 entity types for shape awareness
 *
 * Boundary:
 * - This gate is stateless; it inspects payloads but never writes.
 * - Callers must handle rejection before any DB/artifact write.
 * - Does NOT redact — redaction is the caller's responsibility after gate
 *   approval.
 *
 * Test coverage: tests/unit/storage/write-validation-gate.test.ts
 */
const SENSITIVE_FIELD_PATTERNS = [
    // Order: most specific first to avoid substring shadowing
    {
        field: "raw_private_content",
        reason: "write_validation_failed:raw_private_content_detected",
        pattern: /\braw_private_content\b/i,
    },
    {
        field: "raw_prompt",
        reason: "write_validation_failed:raw_prompt_detected",
        pattern: /\braw_prompt\b/i,
    },
    {
        field: "encryption_key",
        reason: "write_validation_failed:encryption_key_detected",
        pattern: /\bencryption_key\b/i,
    },
    {
        field: "session_token",
        reason: "write_validation_failed:session_token_detected",
        pattern: /\bsession_token\b/i,
    },
    {
        field: "credential",
        reason: "write_validation_failed:credential_detected",
        pattern: /\bcredential\b/i,
    },
    {
        field: "token",
        reason: "write_validation_failed:token_detected",
        pattern: /token/i,
    },
];
/**
 * Detect if a plain object value contains a key that looks like a
 * credential or secret field name.
 */
function detectSensitiveFieldKey(obj) {
    if (obj === null || typeof obj !== "object")
        return undefined;
    const keys = Object.keys(obj);
    for (const key of keys) {
        const lower = key.toLowerCase();
        for (const s of SENSITIVE_FIELD_PATTERNS) {
            if (s.pattern.test(lower)) {
                return s.reason;
            }
        }
    }
    return undefined;
}
/**
 * Recursively scan a value for sensitive field keys at any depth.
 */
function deepScanSensitiveFields(value) {
    const result = detectSensitiveFieldKey(value);
    if (result)
        return result;
    if (Array.isArray(value)) {
        for (const item of value) {
            const r = deepScanSensitiveFields(item);
            if (r)
                return r;
        }
    }
    else if (value !== null && typeof value === "object") {
        for (const v of Object.values(value)) {
            const r = deepScanSensitiveFields(v);
            if (r)
                return r;
        }
    }
    return undefined;
}
/**
 * Validate that sourceRefs is a non-empty tuple.
 */
function validateSourceRefs(sourceRefs) {
    if (!Array.isArray(sourceRefs)) {
        return "write_validation_failed:source_refs_missing";
    }
    if (sourceRefs.length === 0) {
        return "write_validation_failed:source_refs_empty";
    }
    return undefined;
}
/**
 * Lightweight sensitivity scan: rejects obvious PII or secret patterns
 * in string values.
 */
function sensitivityScan(value) {
    if (typeof value === "string") {
        // Basic secret pattern heuristics
        const secretPatterns = [
            /\b[A-Za-z0-9_\-]{32,}\b/, // potential API keys / tokens
            /\b-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
            /\bpassword\s*[:=]\s*\S+/i,
            /\bapi[_\-]?key\s*[:=]\s*\S+/i,
            /\bsecret\s*[:=]\s*\S+/i,
        ];
        for (const p of secretPatterns) {
            if (p.test(value)) {
                return "write_validation_failed:sensitivity_scan_failed";
            }
        }
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            const r = sensitivityScan(item);
            if (r)
                return r;
        }
    }
    else if (value !== null && typeof value === "object") {
        for (const v of Object.values(value)) {
            const r = sensitivityScan(v);
            if (r)
                return r;
        }
    }
    return undefined;
}
/**
 * Validate a write payload before persistence.
 *
 * @param payload — the object about to be written
 * @param options — gate behavior tuning
 * @returns WriteValidationResult: ok=true to proceed, ok=false with reason
 */
export function validateWritePayload(payload, options = {}) {
    const requireSourceRefs = options.requireSourceRefs ?? true;
    const runSensitivityScan = options.runSensitivityScan ?? true;
    const scanFieldKeys = options.scanFieldKeys ?? true;
    // 1. Schema-level: payload must be a non-null object
    if (payload === null || typeof payload !== "object") {
        return {
            ok: false,
            reason: "write_validation_failed:schema_validation_failed",
            details: "Payload must be a non-null object",
        };
    }
    const obj = payload;
    // 2. Sensitive field key detection (DR-022 category 1)
    if (scanFieldKeys) {
        const fieldReason = deepScanSensitiveFields(obj);
        if (fieldReason) {
            return { ok: false, reason: fieldReason };
        }
    }
    // 3. Source refs non-empty for fact-claim-like payloads (DR-022 category 2)
    if (requireSourceRefs) {
        const hasFactClaimShape = "sourceRefs" in obj ||
            ("kind" in obj && (obj.kind === "fact" || obj.kind === "observation" || obj.kind === "pattern"));
        if (hasFactClaimShape) {
            const sourceRefReason = validateSourceRefs(obj.sourceRefs);
            if (sourceRefReason) {
                return { ok: false, reason: sourceRefReason };
            }
        }
    }
    // 4. Sensitivity scan on string values (DR-022 category 3)
    if (runSensitivityScan) {
        const scanReason = sensitivityScan(obj);
        if (scanReason) {
            return { ok: false, reason: scanReason };
        }
    }
    return { ok: true };
}
/**
 * Convenience: assert that payload passes gate, else throw.
 */
export function assertWritePayload(payload, options) {
    const result = validateWritePayload(payload, options);
    if (!result.ok) {
        throw new Error(result.details
            ? `${result.reason}: ${result.details}`
            : (result.reason ?? "write_validation_failed:unknown"));
    }
}
