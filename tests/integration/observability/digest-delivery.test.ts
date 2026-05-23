/**
 * Integration tests for HeartbeatDigest delivery hook — T-OBS.C.4
 *
 * Verification plan §t-obs-c-4:
 *   1. Feishu-like adapter succeeds → deliveredAt + deliveryProof set; no fallbackReason
 *   2. Adapter fails → deliveryFallbackReason set; status not_sent; deliveredAt NOT set
 *   3. Adapter declares "sent" without proof → treated as not_sent; fallbackReason = "delivery_proof_missing"
 *   4. Adapter throws → error absorbed; deliveryFallbackReason set; digest still returned
 *   5. No adapter injected → digest returned without delivery fields
 *   6. Adapter not_sent → fallbackReason propagated verbatim
 *   7. Digest content is never outreach (no "reach out", "I miss you" style phrasing)
 *   8. deliveryProof contains channelId + messageHash only (no raw content)
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  generateHeartbeatDigest,
  type DigestDeliveryAdapter,
  type DigestDeliveryResult,
  type HeartbeatDigest,
} from "../../../src/observability/services/heartbeat-digest-assembler.js";
import { AppendOnlyAuditStore } from "../../../src/observability/audit/append-only-audit-store.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEmptyStore(): AppendOnlyAuditStore {
  return new AppendOnlyAuditStore();
}

function makeFeishuAdapter(opts?: {
  shouldFail?: boolean;
  shouldThrow?: boolean;
  omitProof?: boolean;
}): DigestDeliveryAdapter {
  return {
    deliver: async (_digest: HeartbeatDigest): Promise<DigestDeliveryResult> => {
      if (opts?.shouldThrow) {
        throw new Error("feishu_api_timeout");
      }
      if (opts?.shouldFail) {
        return {
          status: "not_sent",
          fallbackReason: "feishu_channel_unavailable",
        };
      }
      if (opts?.omitProof) {
        return {
          status: "sent",
          // Intentionally omit proof to trigger honesty guard
        };
      }
      return {
        status: "sent",
        proof: {
          channelId: "feishu:dm:user-123",
          messageHash: "sha256:abc123def456",
        },
        deliveredAt: "2026-01-15T10:00:00.000Z",
      };
    },
  };
}

const DATE = "2026-01-15";
const FIXED_NOW = "2026-01-15T09:00:00.000Z";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("HeartbeatDigest delivery — T-OBS.C.4", () => {
  it("Feishu adapter succeeds → deliveredAt + deliveryProof set; no fallbackReason", async () => {
    const store = makeEmptyStore();
    const digest = await generateHeartbeatDigest(DATE, {
      auditStore: store,
      deliveryAdapter: makeFeishuAdapter(),
      now: () => FIXED_NOW,
    });

    assert.ok(digest.deliveredAt, "deliveredAt should be set");
    assert.ok(digest.deliveryProof, "deliveryProof should be set");
    assert.equal(digest.deliveryProof.channelId, "feishu:dm:user-123");
    assert.equal(digest.deliveryProof.messageHash, "sha256:abc123def456");
    assert.equal(digest.deliveryFallbackReason, undefined);
  });

  it("Adapter fails → deliveryFallbackReason set; deliveredAt NOT set", async () => {
    const store = makeEmptyStore();
    const digest = await generateHeartbeatDigest(DATE, {
      auditStore: store,
      deliveryAdapter: makeFeishuAdapter({ shouldFail: true }),
      now: () => FIXED_NOW,
    });

    assert.equal(digest.deliveredAt, undefined, "deliveredAt must not be set on failure");
    assert.equal(digest.deliveryProof, undefined, "deliveryProof must not be set on failure");
    assert.equal(digest.deliveryFallbackReason, "feishu_channel_unavailable");
  });

  it("Adapter declares 'sent' without proof → treated as not_sent", async () => {
    const store = makeEmptyStore();
    const digest = await generateHeartbeatDigest(DATE, {
      auditStore: store,
      deliveryAdapter: makeFeishuAdapter({ omitProof: true }),
      now: () => FIXED_NOW,
    });

    assert.equal(digest.deliveredAt, undefined, "deliveredAt must not be set without proof");
    assert.equal(digest.deliveryProof, undefined);
    assert.equal(digest.deliveryFallbackReason, "delivery_proof_missing");
  });

  it("Adapter throws → error absorbed; deliveryFallbackReason set; digest returned", async () => {
    const store = makeEmptyStore();
    const digest = await generateHeartbeatDigest(DATE, {
      auditStore: store,
      deliveryAdapter: makeFeishuAdapter({ shouldThrow: true }),
      now: () => FIXED_NOW,
    });

    // Must not throw — digest must be returned
    assert.ok(digest, "digest must be returned even when adapter throws");
    assert.equal(digest.deliveredAt, undefined);
    assert.ok(
      digest.deliveryFallbackReason?.startsWith("delivery_error:"),
      `fallbackReason should start with 'delivery_error:', got: ${digest.deliveryFallbackReason}`
    );
    assert.ok(
      digest.deliveryFallbackReason?.includes("feishu_api_timeout"),
      "fallbackReason should include the original error message"
    );
  });

  it("No adapter injected → digest returned without delivery fields", async () => {
    const store = makeEmptyStore();
    const digest = await generateHeartbeatDigest(DATE, {
      auditStore: store,
      now: () => FIXED_NOW,
    });

    assert.equal(digest.deliveredAt, undefined);
    assert.equal(digest.deliveryProof, undefined);
    assert.equal(digest.deliveryFallbackReason, undefined);
  });

  it("Adapter not_sent → fallbackReason propagated verbatim", async () => {
    const adapter: DigestDeliveryAdapter = {
      deliver: async () => ({
        status: "not_sent",
        fallbackReason: "dashboard_mock_disabled",
      }),
    };
    const store = makeEmptyStore();
    const digest = await generateHeartbeatDigest(DATE, {
      auditStore: store,
      deliveryAdapter: adapter,
      now: () => FIXED_NOW,
    });

    assert.equal(digest.deliveryFallbackReason, "dashboard_mock_disabled");
    assert.equal(digest.deliveredAt, undefined);
  });

  it("deliveryProof contains channelId + messageHash (no raw content fields)", async () => {
    const store = makeEmptyStore();
    const digest = await generateHeartbeatDigest(DATE, {
      auditStore: store,
      deliveryAdapter: makeFeishuAdapter(),
      now: () => FIXED_NOW,
    });

    assert.ok(digest.deliveryProof);
    const proofKeys = Object.keys(digest.deliveryProof);
    // Only allowed fields: channelId + messageHash
    assert.ok(proofKeys.includes("channelId"), "proof must have channelId");
    assert.ok(proofKeys.includes("messageHash"), "proof must have messageHash");
    // Must NOT contain raw content
    const forbidden = ["content", "body", "text", "message", "payload", "raw"];
    for (const f of forbidden) {
      assert.ok(!proofKeys.includes(f), `proof must not contain field "${f}"`);
    }
  });

  it("Digest content contains no outreach language (NG2)", async () => {
    const store = makeEmptyStore();
    const digest = await generateHeartbeatDigest(DATE, {
      auditStore: store,
      now: () => FIXED_NOW,
    });

    // Digest is a structured object — no string fields should contain outreach phrases
    const jsonStr = JSON.stringify(digest).toLowerCase();
    const outreachPhrases = ["reach out", "i miss you", "hey there", "how are you", "checking in"];
    for (const phrase of outreachPhrases) {
      assert.ok(
        !jsonStr.includes(phrase),
        `Digest must not contain outreach phrase "${phrase}" (NG2)`
      );
    }
  });
});
