/**
 * v9 Redaction Projector — Unit Tests (T8.1.2)
 *
 * Validates:
 * - containsCredentialValue: detects credential-shaped values
 * - redactPayloadJson: structure-preserving redaction
 * - redactLedgerEntry: blocks on credential values
 * - redactTimelinePayload: masks sensitive fields
 * - redactCharacterFrameEvent: blocks on credential values
 * - validateCharacterSafety: detects forbidden emotion/personality/identity-lock patterns
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  containsCredentialValue,
  redactPayloadJson,
  redactLedgerEntry,
  redactTimelinePayload,
  redactCharacterFrameEvent,
  validateCharacterSafety,
  SENSITIVE_KEY_PATTERNS,
} from "../../../src/observability/v9-redaction-projector.js";

// ───────────────────────────────────────────────────────────────
// containsCredentialValue
// ───────────────────────────────────────────────────────────────

describe("T8.1.2 containsCredentialValue", () => {
  it("returns false for empty payload", () => {
    assert.ok(!containsCredentialValue(""));
    assert.ok(!containsCredentialValue("   "));
  });

  it("returns false for non-credential JSON", () => {
    assert.ok(!containsCredentialValue(JSON.stringify({ foo: "bar", count: 42 })));
  });

  it("detects sensitive key with credential-shaped value", () => {
    // "secret123" is not credential-shaped — it's a short string.
    // Only credential-shaped values (JWT, AWS keys, long hex) trigger block.
    assert.ok(!containsCredentialValue(JSON.stringify({ password: "secret123" })));
    // But a long hex string IS credential-shaped
    assert.ok(containsCredentialValue(JSON.stringify({ password: "a".repeat(40) })));
    // AWS-style key
    assert.ok(containsCredentialValue(JSON.stringify({ api_key: "AKIAABCDEFGHIJKLMNOP" })));
    // Bearer token
    assert.ok(containsCredentialValue(JSON.stringify({ authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123_-" })));
  });

  it("does not flag sensitive key with short non-credential value", () => {
    assert.ok(!containsCredentialValue(JSON.stringify({ password: "short" })));
    assert.ok(!containsCredentialValue(JSON.stringify({ token: "abc" })));
  });

  it("does not flag sensitive key with empty value", () => {
    assert.ok(!containsCredentialValue(JSON.stringify({ password: "" })));
    assert.ok(!containsCredentialValue(JSON.stringify({ token: null })));
  });

  it("detects JWT-like credential values", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123_-";
    assert.ok(containsCredentialValue(JSON.stringify({ data: jwt })));
  });

  it("detects AWS-style keys", () => {
    assert.ok(containsCredentialValue(JSON.stringify({ key: "AKIAABCDEFGHIJKLMNOP" })));
  });

  it("detects nested credential values", () => {
    assert.ok(
      containsCredentialValue(
        JSON.stringify({ config: { credentials: { secret: "a".repeat(42) } } }),
      ),
    );
  });

  it("returns false for invalid JSON without credential patterns", () => {
    assert.ok(!containsCredentialValue("{not valid json"));
  });
});

// ───────────────────────────────────────────────────────────────
// redactPayloadJson
// ───────────────────────────────────────────────────────────────

describe("T8.1.2 redactPayloadJson", () => {
  it("returns empty for null/undefined input", () => {
    const result = redactPayloadJson(null);
    assert.equal(result.json, "");
    assert.ok(!result.containsCredentialValue);
    assert.ok(!result.wasRedacted);
  });

  it("returns empty for empty string", () => {
    const result = redactPayloadJson("");
    assert.equal(result.json, "");
    assert.ok(!result.wasRedacted);
  });

  it("blocks when credential-shaped value detected", () => {
    const result = redactPayloadJson(JSON.stringify({ password: "a".repeat(40) }));
    assert.ok(result.containsCredentialValue);
    assert.ok(!result.wasRedacted);
  });

  it("masks sensitive fields in non-credential payload", () => {
    // Note: "token" as a key with a short value won't trigger credential value detection
    // because the value doesn't match credential patterns. But it will be masked by policy.
    const payload = JSON.stringify({
      data: "normal",
      token: "short", // short value, won't trigger credential detection
    });
    const result = redactPayloadJson(payload);
    assert.ok(!result.containsCredentialValue);
    assert.ok(result.wasRedacted);
    assert.ok(result.manifest.maskedPaths.length > 0);
    const parsed = JSON.parse(result.json);
    assert.equal(parsed.token, "[MASKED]");
    assert.equal(parsed.data, "normal");
  });

  it("erases raw_prompt fields", () => {
    const payload = JSON.stringify({
      raw_prompt: "some prompt content",
      data: "normal",
    });
    const result = redactPayloadJson(payload);
    assert.ok(!result.containsCredentialValue);
    assert.ok(result.wasRedacted);
    const parsed = JSON.parse(result.json);
    assert.equal(parsed.raw_prompt, null);
    assert.equal(parsed.data, "normal");
  });

  it("preserves structure for non-sensitive payload", () => {
    const payload = JSON.stringify({ foo: "bar", count: 42 });
    const result = redactPayloadJson(payload);
    assert.ok(!result.wasRedacted);
    assert.equal(result.json, payload);
  });

  it("handles invalid JSON gracefully", () => {
    const result = redactPayloadJson("{not valid json");
    assert.ok(!result.wasRedacted);
    assert.equal(result.json, "{not valid json");
  });
});

// ───────────────────────────────────────────────────────────────
// redactLedgerEntry
// ───────────────────────────────────────────────────────────────

describe("T8.1.2 redactLedgerEntry", () => {
  it("blocks when credential-shaped value detected", () => {
    const result = redactLedgerEntry(JSON.stringify({ password: "a".repeat(40) }));
    assert.ok(result.blocked);
    assert.equal(result.reasonCode, "ledger_redaction_blocked");
    assert.equal(result.redactedPayloadJson, "");
  });

  it("redacts sensitive fields in non-credential payload", () => {
    const payload = JSON.stringify({
      declaredCapabilities: ["moltbook:feed.read"],
      token: "short",
    });
    const result = redactLedgerEntry(payload);
    assert.ok(!result.blocked);
    assert.ok(result.manifest.maskedPaths.length > 0);
    const parsed = JSON.parse(result.redactedPayloadJson);
    assert.equal(parsed.token, "[MASKED]");
    assert.deepEqual(parsed.declaredCapabilities, ["moltbook:feed.read"]);
  });

  it("passes through non-sensitive payload", () => {
    const payload = JSON.stringify({ reason: "canary_failure" });
    const result = redactLedgerEntry(payload);
    assert.ok(!result.blocked);
    assert.equal(result.redactedPayloadJson, payload);
  });

  it("handles null input", () => {
    const result = redactLedgerEntry(null);
    assert.ok(!result.blocked);
    assert.equal(result.redactedPayloadJson, "");
  });
});

// ───────────────────────────────────────────────────────────────
// redactTimelinePayload
// ───────────────────────────────────────────────────────────────

describe("T8.1.2 redactTimelinePayload", () => {
  it("masks sensitive fields in timeline payload", () => {
    const payload = JSON.stringify({
      event: "stage_completed",
      token: "short",
    });
    const result = redactTimelinePayload(payload);
    assert.ok(!result.containsCredentialValue);
    assert.ok(result.wasRedacted);
    const parsed = JSON.parse(result.json);
    assert.equal(parsed.token, "[MASKED]");
  });

  it("detects credential values in timeline payload and replaces with placeholder", () => {
    const result = redactTimelinePayload(JSON.stringify({ api_key: "AKIAABCDEFGHIJKLMNOP" }));
    assert.ok(result.containsCredentialValue);
    assert.ok(result.wasRedacted);
    const parsed = JSON.parse(result.json);
    assert.equal(parsed.redacted, "credential_value_detected");
    // Original credential value must not appear in output
    assert.ok(!result.json.includes("AKIA"));
  });
});

// ───────────────────────────────────────────────────────────────
// redactCharacterFrameEvent
// ───────────────────────────────────────────────────────────────

describe("T8.1.2 redactCharacterFrameEvent", () => {
  it("blocks when credential-shaped value detected", () => {
    const result = redactCharacterFrameEvent(JSON.stringify({ password: "a".repeat(40) }));
    assert.ok(result.blocked);
    assert.equal(result.reasonCode, "ledger_redaction_blocked");
  });

  it("redacts sensitive fields in character event", () => {
    const payload = JSON.stringify({
      frameId: "frame-1",
      projectionState: "accepted",
      token: "short",
    });
    const result = redactCharacterFrameEvent(payload);
    assert.ok(!result.blocked);
    const parsed = JSON.parse(result.redactedPayloadJson);
    assert.equal(parsed.token, "[MASKED]");
    assert.equal(parsed.frameId, "frame-1");
  });
});

// ───────────────────────────────────────────────────────────────
// validateCharacterSafety (ADR-006)
// ───────────────────────────────────────────────────────────────

describe("T8.1.2 validateCharacterSafety", () => {
  it("passes for safe character text", () => {
    const result = validateCharacterSafety("User prefers concise communication style.");
    assert.ok(result.safe);
    assert.equal(result.violatedPatterns.length, 0);
  });

  it("passes for safe Chinese character text", () => {
    const result = validateCharacterSafety("用户偏好简洁的沟通风格。");
    assert.ok(result.safe);
  });

  it("detects English emotion assertions", () => {
    const result = validateCharacterSafety("I feel happy about the feedback.");
    assert.ok(!result.safe);
    assert.ok(result.violatedPatterns.length > 0);
  });

  it("detects Chinese emotion assertions", () => {
    const result = validateCharacterSafety("我感到开心");
    assert.ok(!result.safe);
  });

  it("detects personality scores", () => {
    const result = validateCharacterSafety("openness: 0.8, conscientiousness: 0.7");
    assert.ok(!result.safe);
  });

  it("detects Chinese personality scores", () => {
    const result = validateCharacterSafety("人格分数: 85");
    assert.ok(!result.safe);
  });

  it("detects identity locks (English)", () => {
    const result = validateCharacterSafety("You are a kind person.");
    assert.ok(!result.safe);
  });

  it("detects identity locks (Chinese)", () => {
    const result = validateCharacterSafety("你是一个温柔的人");
    assert.ok(!result.safe);
  });

  it("detects hard control rules (English)", () => {
    const result = validateCharacterSafety("You must always be polite.");
    assert.ok(!result.safe);
  });

  it("detects hard control rules (Chinese)", () => {
    const result = validateCharacterSafety("你必须总是保持礼貌");
    assert.ok(!result.safe);
  });

  it("passes for neutral observational text", () => {
    const result = validateCharacterSafety(
      "User tends to ask clarifying questions before acting. Sources: 3 closures, 2 feedback entries.",
    );
    assert.ok(result.safe);
  });
});

// ───────────────────────────────────────────────────────────────
// SENSITIVE_KEY_PATTERNS
// ───────────────────────────────────────────────────────────────

describe("T8.1.2 SENSITIVE_KEY_PATTERNS", () => {
  it("matches password key", () => {
    assert.ok(SENSITIVE_KEY_PATTERNS.some((p) => p.test("password")));
  });

  it("matches api_key key", () => {
    assert.ok(SENSITIVE_KEY_PATTERNS.some((p) => p.test("api_key")));
  });

  it("matches authorization key", () => {
    assert.ok(SENSITIVE_KEY_PATTERNS.some((p) => p.test("authorization")));
  });

  it("does not match non-sensitive key", () => {
    assert.ok(!SENSITIVE_KEY_PATTERNS.some((p) => p.test("username")));
  });
});
