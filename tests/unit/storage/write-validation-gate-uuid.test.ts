/**
 * WriteValidationGate UUID / sourceRef exemption tests (T-OBS.R.5)
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { validateWritePayload } from "../../../src/storage/services/write-validation-gate.js";

describe("write-validation-gate uuid and identifier exemption", () => {
  it("accepts payload containing a UUID in id field", () => {
    const result = validateWritePayload({
      id: "550e8400-e29b-41d4-a716-446655440000",
      sourceRefs: [{ uri: "sn://test", family: "evidence", id: "x", redactionClass: "none", resolveStatus: "resolvable" }],
    });
    assert.equal(result.ok, true);
  });

  it("accepts sourceRef URI containing 32+ char identifier", () => {
    const result = validateWritePayload({
      sourceRefs: [
        {
          uri: "sn://connector_result/moltbook/feed.read/abcdefghijklmnopqrstuvwxyz123456",
          family: "connector_result",
          id: "abcdefghijklmnopqrstuvwxyz123456",
          redactionClass: "none",
          resolveStatus: "resolvable",
        },
      ],
    });
    assert.equal(result.ok, true);
  });

  it("rejects Bearer token and reports field/pattern", () => {
    const result = validateWritePayload({
      content: "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
      sourceRefs: [{ uri: "sn://test", family: "evidence", id: "x", redactionClass: "none", resolveStatus: "resolvable" }],
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, "write_validation_failed:sensitivity_scan_failed");
    assert.ok(result.field, "field is reported");
    assert.ok(result.pattern, "pattern is reported");
  });

  it("rejects API key assignment", () => {
    const result = validateWritePayload({
      content: "api_key = 'sk-abcdefghijklmnopqrstuvwxyz123456'",
      sourceRefs: [{ uri: "sn://test", family: "evidence", id: "x", redactionClass: "none", resolveStatus: "resolvable" }],
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, "write_validation_failed:sensitivity_scan_failed");
  });
});
