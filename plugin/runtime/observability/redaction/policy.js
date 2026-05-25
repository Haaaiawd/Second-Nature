export const REDACTION_CONFIG = {
    maskedFieldNames: [
        "token",
        "access_token",
        "refresh_token",
        "api_key",
        "apiSecret",
        "secret",
        "password",
        "bearer_token",
        "authorization",
        "node_secret",
        "encryption_key", // v7
        "key_material", // v7
    ],
    eraseFieldNames: [
        "full_message",
        "full_post",
        "private_message",
        "prompt",
        "system_prompt",
        "completion",
        "response_content",
        "raw_payload", // v7
        "credential_value", // v7
        "raw_prompt", // v7
    ],
    hashFieldNames: [
        "user_id",
        "session_id",
        "trace_id",
        "content_hash",
        "message_hash", // v7
    ],
    sensitivityLevels: ["public", "internal", "confidential", "restricted"],
};
export const DEFAULT_REDACTION_POLICY = {
    defaultPolicy: [
        { fieldName: "token", action: "mask" },
        { fieldName: "access_token", action: "mask" },
        { fieldName: "refresh_token", action: "mask" },
        { fieldName: "api_key", action: "mask" },
        { fieldName: "apiSecret", action: "mask" },
        { fieldName: "secret", action: "mask" },
        { fieldName: "password", action: "mask" },
        { fieldName: "bearer_token", action: "mask" },
        { fieldName: "authorization", action: "mask" },
        { fieldName: "node_secret", action: "mask" },
        { fieldName: "encryption_key", action: "mask" },
        { fieldName: "key_material", action: "mask" },
        { fieldName: "full_message", action: "erase" },
        { fieldName: "full_post", action: "erase" },
        { fieldName: "private_message", action: "erase" },
        { fieldName: "prompt", action: "erase" },
        { fieldName: "system_prompt", action: "erase" },
        { fieldName: "completion", action: "erase" },
        { fieldName: "response_content", action: "erase" },
        { fieldName: "raw_payload", action: "erase" },
        { fieldName: "credential_value", action: "erase" },
        { fieldName: "raw_prompt", action: "erase" },
        { fieldName: "content_hash", action: "hash" },
        { fieldName: "message_hash", action: "hash" },
    ],
    fieldOverrides: {},
    maxFieldLength: 500,
};
export function getFieldRedactionRule(fieldName, policy = DEFAULT_REDACTION_POLICY) {
    for (const rule of policy.defaultPolicy) {
        if (rule.fieldName === fieldName) {
            return rule;
        }
    }
    for (const [prefix, rules] of Object.entries(policy.fieldOverrides)) {
        if (fieldName.startsWith(prefix)) {
            for (const rule of rules) {
                if (rule.fieldName === fieldName || rule.fieldName === "*") {
                    return rule;
                }
            }
        }
    }
    return { fieldName, action: "keep" };
}
// ─── Unified Redaction Gate (T-OBS.C.1 / DR-033) ────────────────────────────
import * as crypto from "node:crypto";
/**
 * Unified redaction gate — all audit-bound payloads must pass through this
 * before persistence. Recursively applies mask/erase/hash rules from the
 * active RedactionPolicy, preserving object shape (erase → null, not delete).
 *
 * Boundary:
 * - Arrays are not recursed (avoid unbounded complexity).
 * - erase fields become null so downstream JSON schema stays stable.
 * - hash uses SHA-256 of the stringified original value.
 */
export function redactPayload(payload, policy = DEFAULT_REDACTION_POLICY) {
    const maskedPaths = [];
    const erasedPaths = [];
    const hashedPaths = [];
    function processValue(obj, path) {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            const fullPath = path ? `${path}.${key}` : key;
            const rule = getFieldRedactionRule(key, policy);
            if (rule.action === "mask") {
                result[key] = "[MASKED]";
                maskedPaths.push(fullPath);
            }
            else if (rule.action === "erase") {
                result[key] = null;
                erasedPaths.push(fullPath);
            }
            else if (rule.action === "hash") {
                result[key] = typeof value === "string"
                    ? crypto.createHash("sha256").update(value).digest("hex")
                    : value;
                hashedPaths.push(fullPath);
            }
            else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
                result[key] = processValue(value, fullPath);
            }
            else {
                result[key] = value;
            }
        }
        return result;
    }
    const redactedPayload = processValue(payload, "");
    return {
        payload: redactedPayload,
        manifest: {
            maskedPaths,
            erasedPaths,
            hashedPaths,
            sensitivity: inferSensitivity(maskedPaths, erasedPaths),
        },
    };
}
function inferSensitivity(masked, erased) {
    if (erased.length > 0)
        return "restricted";
    if (masked.length > 0)
        return "confidential";
    return "internal";
}
