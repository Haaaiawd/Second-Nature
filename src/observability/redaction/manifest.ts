import * as crypto from "crypto";
import { REDACTION_CONFIG, type SensitivityLevel } from "./policy.js";

export interface RedactionManifest {
  id: string;
  sensitivityLevel: SensitivityLevel;
  maskedFields: string[];
  erasedFields: string[];
  hashedFields: string[];
  originalFieldCount: number;
  redactedFieldCount: number;
  createdAt: string;
}

export interface RedactionResult<T> {
  redacted: T;
  manifest: RedactionManifest;
}

export function redactEvent<T extends Record<string, unknown>>(event: T): RedactionResult<T> {
  const maskedFields: string[] = [];
  const erasedFields: string[] = [];
  const hashedFields: string[] = [];

  const output = { ...event } as Record<string, unknown>;
  const originalFieldCount = Object.keys(output).length;

  for (const key of Object.keys(output)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey === "token" ||
      lowerKey === "access_token" ||
      lowerKey === "refresh_token" ||
      lowerKey === "api_key" ||
      lowerKey === "apisecret" ||
      lowerKey === "secret" ||
      lowerKey === "password" ||
      lowerKey === "bearer_token" ||
      lowerKey === "authorization" ||
      lowerKey === "node_secret"
    ) {
      output[key] = "[MASKED]";
      maskedFields.push(key);
    } else if (
      lowerKey === "full_message" ||
      lowerKey === "full_post" ||
      lowerKey === "private_message" ||
      lowerKey === "prompt" ||
      lowerKey === "system_prompt" ||
      lowerKey === "completion" ||
      lowerKey === "response_content"
    ) {
      delete output[key];
      erasedFields.push(key);
    } else if (
      lowerKey === "content_hash" ||
      lowerKey === "trace_id" ||
      lowerKey === "user_id" ||
      lowerKey === "session_id"
    ) {
      const originalValue = output[key];
      if (typeof originalValue === "string") {
        output[key] = crypto.createHash("sha256").update(originalValue).digest("hex").slice(0, 16);
      }
      hashedFields.push(key);
    }
  }

  const redactedFieldCount = Object.keys(output).length;

  return {
    redacted: output as T,
    manifest: {
      id: `rm:${Date.now()}:${crypto.randomBytes(4).toString("hex")}`,
      sensitivityLevel: "internal",
      maskedFields,
      erasedFields,
      hashedFields,
      originalFieldCount,
      redactedFieldCount,
      createdAt: new Date().toISOString(),
    },
  };
}

export function createEmptyManifest(): RedactionManifest {
  return {
    id: `rm:${Date.now()}:empty`,
    sensitivityLevel: "internal",
    maskedFields: [],
    erasedFields: [],
    hashedFields: [],
    originalFieldCount: 0,
    redactedFieldCount: 0,
    createdAt: new Date().toISOString(),
  };
}

export function mergeManifests(manifests: RedactionManifest[]): RedactionManifest {
  const merged: RedactionManifest = {
    id: `rm:${Date.now()}:merged`,
    sensitivityLevel: "internal",
    maskedFields: [],
    erasedFields: [],
    hashedFields: [],
    originalFieldCount: 0,
    redactedFieldCount: 0,
    createdAt: new Date().toISOString(),
  };

  for (const m of manifests) {
    merged.maskedFields.push(...m.maskedFields);
    merged.erasedFields.push(...m.erasedFields);
    merged.hashedFields.push(...m.hashedFields);
    merged.originalFieldCount += m.originalFieldCount;
    merged.redactedFieldCount += m.redactedFieldCount;
    if (m.sensitivityLevel === "restricted") {
      merged.sensitivityLevel = "restricted";
    } else if (m.sensitivityLevel === "confidential" && merged.sensitivityLevel !== "restricted") {
      merged.sensitivityLevel = "confidential";
    }
  }

  return merged;
}