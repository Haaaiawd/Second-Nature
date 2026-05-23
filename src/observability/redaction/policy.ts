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

// ─── Unified Redaction Gate (T-OBS.C.1 / DR-033) ────────────────────────────

import * as crypto from "node:crypto";

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
export function redactPayload<T extends object>(
  payload: T,
  policy: RedactionPolicy = DEFAULT_REDACTION_POLICY,
): RedactPayloadResult<T> {
  const maskedPaths: string[] = [];
  const erasedPaths: string[] = [];
  const hashedPaths: string[] = [];

  function processValue(obj: Record<string, unknown>, path: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const fullPath = path ? `${path}.${key}` : key;
      const rule = getFieldRedactionRule(key, policy);

      if (rule.action === "mask") {
        result[key] = "***";
        maskedPaths.push(fullPath);
      } else if (rule.action === "erase") {
        result[key] = null;
        erasedPaths.push(fullPath);
      } else if (rule.action === "hash") {
        result[key] = typeof value === "string"
          ? crypto.createHash("sha256").update(value).digest("hex")
          : value;
        hashedPaths.push(fullPath);
      } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        result[key] = processValue(value as Record<string, unknown>, fullPath);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  const redactedPayload = processValue(payload as Record<string, unknown>, "") as T;

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

function inferSensitivity(masked: string[], erased: string[]): SensitivityLevel {
  if (erased.length > 0) return "restricted";
  if (masked.length > 0) return "confidential";
  return "internal";
}