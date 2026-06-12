/**
 * Failure Taxonomy — Unit Tests (T-CS.R.2)
 *
 * Validates: HTTP status codes map to actionable failure classes;
 * unknown shapes fall back to unknown_platform_change.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  classifyFailure,
  ConnectorPolicyError,
  FAILURE_CLASSES,
  type FailureClass,
} from "../../../src/connectors/base/failure-taxonomy.js";

describe("failure-taxonomy", () => {
  it("maps 401/403 to auth_failure", () => {
    assert.equal(classifyFailure({ code: "api_error", status: 401 }).class, "auth_failure");
    assert.equal(classifyFailure({ code: "api_error", status: 403 }).class, "auth_failure");
  });

  it("maps 404/422 to permanent_input_error", () => {
    assert.equal(classifyFailure({ code: "api_error", status: 404 }).class, "permanent_input_error");
    assert.equal(classifyFailure({ code: "api_error", status: 422 }).class, "permanent_input_error");
  });

  it("maps 429 to rate_limited", () => {
    const result = classifyFailure({ code: "api_error", status: 429, retryAfterSeconds: 60 });
    assert.equal(result.class, "rate_limited");
    assert.equal(result.retryAfterMs, 60000);
  });

  it("maps 5xx to transport_failure", () => {
    for (const status of [500, 502, 503, 504]) {
      assert.equal(classifyFailure({ code: "api_error", status }).class, "transport_failure");
    }
  });

  it("reads statusCode field from MoltbookApiError-like errors", () => {
    class MockApiError extends Error {
      constructor(public readonly statusCode: number, message: string) {
        super(message);
      }
    }
    const error = new MockApiError(503, "Moltbook API error: 503");
    assert.equal(classifyFailure(error).class, "transport_failure");
  });

  it("reads status as string", () => {
    assert.equal(classifyFailure({ status: "401" }).class, "auth_failure");
  });

  it("falls back to unknown_platform_change for unclassified errors", () => {
    assert.equal(classifyFailure(new Error("random failure")).class, "unknown_platform_change");
    assert.equal(classifyFailure({ code: "api_error" }).class, "unknown_platform_change");
  });

  it("preserves ConnectorPolicyError class and retryAfterMs", () => {
    const error = new ConnectorPolicyError("cooldown_blocked", "blocked", 30000);
    const result = classifyFailure(error);
    assert.equal(result.class, "cooldown_blocked");
    assert.equal(result.retryAfterMs, 30000);
    assert.equal(result.retryable, false);
  });

  it("maps known codes directly", () => {
    const cases: Array<[Record<string, unknown>, FailureClass]> = [
      [{ code: "auth_failure" }, "auth_failure"],
      [{ code: "configuration_missing" }, "configuration_missing"],
      [{ code: "platform_unavailable" }, "platform_unavailable"],
      [{ code: "timeout" }, "timeout"],
    ];
    for (const [error, expected] of cases) {
      assert.equal(classifyFailure(error).class, expected);
    }
  });

  it("has canonical failure classes", () => {
    assert.ok(FAILURE_CLASSES.includes("auth_failure"));
    assert.ok(FAILURE_CLASSES.includes("transport_failure"));
    assert.ok(FAILURE_CLASSES.includes("unknown_platform_change"));
  });
});
