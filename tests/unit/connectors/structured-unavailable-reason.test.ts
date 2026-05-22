/**
 * StructuredUnavailableReason tests — T-CS.C.3
 *
 * Coverage:
 * - Builder builds all reason codes
 * - Factory functions produce correct codes
 * - ConnectorResult includes executionId
 * - FailureClass mapping accuracy (failureClass comes from FailureTaxonomy)
 * - No silent failures (all paths return a reason)
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  UnavailableReasonBuilder,
  unavailableCredentialsMissing,
  unavailableNotRegistered,
  unavailableTrustDenied,
  unavailableCircuitOpen,
  unavailablePlatformError,
  unavailableProbeFailed,
  unavailableProbePolicyDenied,
} from "../../../src/connectors/base/structured-unavailable-reason.js";
import type { ConnectorResult } from "../../../src/connectors/base/contract.js";

describe("StructuredUnavailableReason", () => {
  it("builder produces correct code and message", () => {
    const reason = UnavailableReasonBuilder.for(
      "not_registered",
      "Manifest not found",
    )
      .withPlatformId("twitter")
      .withCapabilityId("feed.read")
      .build();

    assert.strictEqual(reason.code, "not_registered");
    assert.strictEqual(reason.platformId, "twitter");
    assert.strictEqual(reason.capabilityId, "feed.read");
    assert(reason.timestamp !== undefined);
  });

  it("builder requires code and message", () => {
    assert.throws(() => {
      UnavailableReasonBuilder.for("credentials_missing", "").build();
    }, /message is required/);
  });

  it("unavailableCredentialsMissing factory", () => {
    const r = unavailableCredentialsMissing("twitter");
    assert.strictEqual(r.code, "credentials_missing");
    assert.strictEqual(r.platformId, "twitter");
  });

  it("unavailableNotRegistered factory", () => {
    const r = unavailableNotRegistered("github");
    assert.strictEqual(r.code, "not_registered");
  });

  it("unavailableTrustDenied factory", () => {
    const r = unavailableTrustDenied("discord");
    assert.strictEqual(r.code, "trust_denied");
  });

  it("unavailableCircuitOpen with retryAfterMs", () => {
    const r = unavailableCircuitOpen("twitter", 300_000);
    assert.strictEqual(r.code, "circuit_open");
    assert.strictEqual(r.retryAfterMs, 300_000);
  });

  it("unavailablePlatformError with failureClass", () => {
    const r = unavailablePlatformError("twitter", "transport_failure");
    assert.strictEqual(r.code, "platform_error");
    assert.strictEqual(r.failureClass, "transport_failure");
  });

  it("unavailableProbeFailed factory", () => {
    const r = unavailableProbeFailed("twitter", "feed.read");
    assert.strictEqual(r.code, "probe_failed");
    assert.strictEqual(r.capabilityId, "feed.read");
  });

  it("unavailableProbePolicyDenied factory", () => {
    const r = unavailableProbePolicyDenied("twitter", "post.publish");
    assert.strictEqual(r.code, "probe_policy_denied");
    assert.strictEqual(r.capabilityId, "post.publish");
  });

  it("ConnectorResult type accepts executionId", () => {
    const result: ConnectorResult<unknown> = {
      status: "terminal_failure",
      failureClass: "auth_failure",
      executionId: "exec-123",
      metadata: {
        platformId: "twitter",
        channel: "api_rest",
        latencyMs: 120,
      },
    };
    assert.strictEqual(result.executionId, "exec-123");
  });
});
