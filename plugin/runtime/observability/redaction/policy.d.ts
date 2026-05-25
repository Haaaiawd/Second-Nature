export declare const REDACTION_CONFIG: {
    readonly maskedFieldNames: readonly ["token", "access_token", "refresh_token", "api_key", "apiSecret", "secret", "password", "bearer_token", "authorization", "node_secret", "encryption_key", "key_material"];
    readonly eraseFieldNames: readonly ["full_message", "full_post", "private_message", "prompt", "system_prompt", "completion", "response_content", "raw_payload", "credential_value", "raw_prompt"];
    readonly hashFieldNames: readonly ["user_id", "session_id", "trace_id", "content_hash", "message_hash"];
    readonly sensitivityLevels: readonly ["public", "internal", "confidential", "restricted"];
};
export type SensitivityLevel = (typeof REDACTION_CONFIG)["sensitivityLevels"][number];
export interface RedactionRule {
    fieldName: string;
    action: "mask" | "erase" | "hash" | "keep";
    pattern?: RegExp;
}
export interface RedactionPolicy {
    defaultPolicy: RedactionRule[];
    fieldOverrides: Record<string, RedactionRule[]>;
    maxFieldLength: number;
}
export declare const DEFAULT_REDACTION_POLICY: RedactionPolicy;
export declare function getFieldRedactionRule(fieldName: string, policy?: RedactionPolicy): RedactionRule;
export interface RedactPayloadManifest {
    maskedPaths: string[];
    erasedPaths: string[];
    hashedPaths: string[];
    sensitivity: SensitivityLevel;
}
export interface RedactPayloadResult<T> {
    payload: T;
    manifest: RedactPayloadManifest;
}
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
export declare function redactPayload<T extends object>(payload: T, policy?: RedactionPolicy): RedactPayloadResult<T>;
