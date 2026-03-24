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
  ],
  eraseFieldNames: [
    "full_message",
    "full_post",
    "private_message",
    "prompt",
    "system_prompt",
    "completion",
    "response_content",
  ],
  hashFieldNames: [
    "user_id",
    "session_id",
    "trace_id",
    "content_hash",
  ],
  sensitivityLevels: ["public", "internal", "confidential", "restricted"] as const,
} as const;

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

export const DEFAULT_REDACTION_POLICY: RedactionPolicy = {
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
    { fieldName: "full_message", action: "erase" },
    { fieldName: "full_post", action: "erase" },
    { fieldName: "private_message", action: "erase" },
    { fieldName: "prompt", action: "erase" },
    { fieldName: "system_prompt", action: "erase" },
    { fieldName: "completion", action: "erase" },
    { fieldName: "response_content", action: "erase" },
    { fieldName: "content_hash", action: "hash" },
  ],
  fieldOverrides: {},
  maxFieldLength: 500,
};

export function getFieldRedactionRule(fieldName: string, policy: RedactionPolicy = DEFAULT_REDACTION_POLICY): RedactionRule {
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