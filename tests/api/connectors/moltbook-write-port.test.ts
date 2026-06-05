/**
 * MoltBook Write Port — API Tests (T-CS.R.1)
 *
 * Validates: policy-bound write dispatch at the connector port level,
 * dry-run/owner-confirm modes, and closure-ready result shapes.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { dispatchPolicyBoundWrite } from "../../../src/connectors/base/policy-bound-write-dispatch.js";
import type { ConnectorRequest, ConnectorResult } from "../../../src/connectors/base/contract.js";

async function fakeDryRunExecute(req: ConnectorRequest): Promise<ConnectorResult<unknown>> {
  // This should never be called in dry-run mode
  return {
    status: "success",
    data: { unexpected: true },
    metadata: {
      platformId: req.platformId,
      channel: "api_rest",
      latencyMs: 0,
    },
  };
}

describe("moltbook-write-port", () => {
  it("dry-run port returns simulated result without calling execute", async () => {
    const req: ConnectorRequest = {
      platformId: "moltbook",
      intent: "post.publish",
      payload: { text: "Test post", mediaUrl: "https://example.com/img.png" },
      idempotencyKey: "dry-run-key-001",
      decisionId: "dec-dry-001",
      intentId: "int-dry-001",
      policyProof: {
        decisionId: "dec-dry-001",
        decision: "allow",
        dryRun: true,
        reason: "low_risk_source_backed",
      },
    };

    const result = await dispatchPolicyBoundWrite(req, fakeDryRunExecute);

    assert.equal(result.status, "dry_run");
    assert.equal(result.reason, "dry_run_simulated_success");
    assert.ok(result.simulatedPayload, "should contain simulated payload");
    assert.equal(result.simulatedPayload?.text, "Test post");
    assert.equal(result.simulatedPayload?._simulated, true);
    assert.equal(result.simulatedPayload?._idempotencyKey, "dry-run-key-001");
    assert.equal(result.simulatedPayload?._decisionId, "dec-dry-001");
    assert.ok(!result.connectorResult, "should not have connector result in dry-run");
  });

  it("owner-confirm port defers without execute call", async () => {
    const req: ConnectorRequest = {
      platformId: "moltbook",
      intent: "comment.reply",
      payload: { commentId: "c-123", text: "Thanks!" },
      idempotencyKey: "owner-confirm-key-001",
      decisionId: "dec-owner-001",
      intentId: "int-owner-001",
      policyProof: {
        decisionId: "dec-owner-001",
        decision: "allow",
        ownerConfirmMode: true,
        reason: "medium_risk_requires_owner",
      },
    };

    const result = await dispatchPolicyBoundWrite(req, fakeDryRunExecute);

    assert.equal(result.status, "deferred");
    assert.equal(result.reason, "owner_confirm_pending");
    assert.ok(!result.connectorResult, "should not call execute");
  });

  it("owner-confirmed port allows full execution", async () => {
    const req: ConnectorRequest = {
      platformId: "moltbook",
      intent: "post.publish",
      payload: { text: "Confirmed post" },
      idempotencyKey: "exec-key-001",
      decisionId: "dec-exec-001",
      intentId: "int-exec-001",
      policyProof: {
        decisionId: "dec-exec-001",
        decision: "allow",
        ownerConfirmed: true,
        reason: "owner_approved_low_risk",
      },
    };

    const result = await dispatchPolicyBoundWrite(req, async (_r) => ({
      status: "success",
      data: { postId: "p-789" },
      metadata: {
        platformId: "moltbook",
        channel: "api_rest",
        latencyMs: 120,
      },
    }));

    assert.equal(result.status, "allowed");
    assert.equal(result.reason, "execution_completed");
    assert.ok(result.connectorResult, "should have connector result");
    assert.deepStrictEqual(result.connectorResult?.data, { postId: "p-789" });
  });

  it("port shape is ready for closure recording", async () => {
    const req: ConnectorRequest = {
      platformId: "moltbook",
      intent: "comment.reply",
      payload: { text: "Reply" },
      idempotencyKey: "closure-key-001",
      decisionId: "dec-closure-001",
      intentId: "int-closure-001",
      policyProof: {
        decisionId: "dec-closure-001",
        decision: "allow",
        dryRun: true,
      },
    };

    const result = await dispatchPolicyBoundWrite(req, fakeDryRunExecute);

    // Verify the result shape can be consumed by closure recorder
    assert.ok(result.status, "result has status");
    assert.ok(result.reason, "result has reason");
    assert.ok(result.simulatedPayload || result.connectorResult, "result has payload or result");

    // No credential leakage at the port boundary
    const resultJson = JSON.stringify(result);
    assert.ok(!resultJson.includes("apiKey"), "should not leak apiKey");
    assert.ok(!resultJson.includes("secret"), "should not leak secret");
    assert.ok(!resultJson.includes("token"), "should not leak token");
  });
});
