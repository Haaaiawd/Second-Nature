/**
 * T-SMS.C.1 — WriteValidationGate 单元测试
 *
 * Verification types (05A / 05B):
 * - 单元测试: 4 类拒绝条件；gate 不可绕过；敏感字段检测
 *
 * Dependencies: `src/storage/services/write-validation-gate.ts`
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  validateWritePayload,
  assertWritePayload,
  type WriteValidationFailureReason,
} from "../../../src/storage/services/write-validation-gate.js";

describe("WriteValidationGate — sensitive field detection", () => {
  it("rejects payload with credential field", () => {
    const result = validateWritePayload({
      userId: "u-1",
      credential: "secret123",
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(
      result.reason,
      "write_validation_failed:credential_detected" as WriteValidationFailureReason,
    );
  });

  it("rejects payload with token field", () => {
    const result = validateWritePayload({
      apiToken: "tk-123",
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(
      result.reason,
      "write_validation_failed:token_detected" as WriteValidationFailureReason,
    );
    assert.strictEqual(result.field, "apiToken");
  });

  it("rejects payload with raw_private_content field", () => {
    const result = validateWritePayload({
      raw_private_content: "some dm text",
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(
      result.reason,
      "write_validation_failed:raw_private_content_detected" as WriteValidationFailureReason,
    );
  });

  it("rejects payload with raw_prompt field", () => {
    const result = validateWritePayload({
      raw_prompt: "system: you are...",
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(
      result.reason,
      "write_validation_failed:raw_prompt_detected" as WriteValidationFailureReason,
    );
  });

  it("rejects payload with encryption_key field", () => {
    const result = validateWritePayload({
      encryption_key: "AES256:...",
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(
      result.reason,
      "write_validation_failed:encryption_key_detected" as WriteValidationFailureReason,
    );
  });

  it("rejects payload with session_token field", () => {
    const result = validateWritePayload({
      session_token: "sess-abc",
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(
      result.reason,
      "write_validation_failed:session_token_detected" as WriteValidationFailureReason,
    );
  });

  it("detects sensitive field nested in array", () => {
    const result = validateWritePayload({
      items: [{ credential: "nested" }],
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(
      result.reason,
      "write_validation_failed:credential_detected" as WriteValidationFailureReason,
    );
  });

  it("detects sensitive field nested in object", () => {
    const result = validateWritePayload({
      meta: { raw_prompt: "nested" },
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(
      result.reason,
      "write_validation_failed:raw_prompt_detected" as WriteValidationFailureReason,
    );
  });
});

describe("WriteValidationGate — source refs non-empty (DR-025)", () => {
  it("rejects fact claim with empty sourceRefs", () => {
    const result = validateWritePayload({
      kind: "fact",
      text: "something",
      sourceRefs: [],
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(
      result.reason,
      "write_validation_failed:source_refs_empty" as WriteValidationFailureReason,
    );
  });

  it("rejects fact claim with missing sourceRefs", () => {
    const result = validateWritePayload({
      kind: "fact",
      text: "something",
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(
      result.reason,
      "write_validation_failed:source_refs_missing" as WriteValidationFailureReason,
    );
  });

  it("accepts fact claim with non-empty sourceRefs", () => {
    const result = validateWritePayload({
      kind: "fact",
      text: "something",
      sourceRefs: ["evidence:001"],
    });
    assert.strictEqual(result.ok, true);
  });

  it("accepts non-fact payload without sourceRefs when not required", () => {
    const result = validateWritePayload(
      { name: "test" },
      { requireSourceRefs: false },
    );
    assert.strictEqual(result.ok, true);
  });
});

describe("WriteValidationGate — sensitivity scan", () => {
  it("rejects payload containing string that looks like an API key", () => {
    const result = validateWritePayload({
      description: "key: abcdef1234567890abcdef1234567890abcdef12",
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(
      result.reason,
      "write_validation_failed:sensitivity_scan_failed" as WriteValidationFailureReason,
    );
  });

  it("accepts plain benign payload", () => {
    const result = validateWritePayload({
      name: "hello world",
      count: 42,
    });
    assert.strictEqual(result.ok, true);
  });
});

describe("WriteValidationGate — schema validation", () => {
  it("rejects null payload", () => {
    const result = validateWritePayload(null);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(
      result.reason,
      "write_validation_failed:schema_validation_failed" as WriteValidationFailureReason,
    );
  });

  it("rejects string payload", () => {
    const result = validateWritePayload("not an object");
    assert.strictEqual(result.ok, false);
    assert.strictEqual(
      result.reason,
      "write_validation_failed:schema_validation_failed" as WriteValidationFailureReason,
    );
  });
});

describe("WriteValidationGate — assert helper", () => {
  it("throws on rejected payload", () => {
    assert.throws(() => {
      assertWritePayload({ credential: "x" });
    }, /write_validation_failed:credential_detected/);
  });

  it("does not throw on approved payload", () => {
    assert.doesNotThrow(() => {
      assertWritePayload({ name: "ok", sourceRefs: ["ref:1"] });
    });
  });
});

describe("WriteValidationGate — gate cannot be bypassed", () => {
  it("all 4 rejection categories are reachable", () => {
    const reasons: WriteValidationFailureReason[] = [
      validateWritePayload({ credential: "x" }).reason!,
      validateWritePayload({ kind: "fact", text: "x" }).reason!,
      validateWritePayload({ description: "key: abcdef1234567890abcdef1234567890abcdef12" }).reason!,
      validateWritePayload(null).reason!,
    ];
    assert.strictEqual(reasons.length, 4);
    assert.ok(reasons.every((r) => r.startsWith("write_validation_failed:")));
  });
});
