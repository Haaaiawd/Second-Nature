export declare const REDACTION_CONFIG: {
    readonly maskedFieldNames: readonly ["token", "access_token", "refresh_token", "api_key", "apiSecret", "secret", "password", "bearer_token", "authorization", "node_secret"];
    readonly eraseFieldNames: readonly ["full_message", "full_post", "private_message", "prompt", "system_prompt", "completion", "response_content"];
    readonly hashFieldNames: readonly ["user_id", "session_id", "trace_id", "content_hash"];
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
