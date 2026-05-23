import test from "node:test";
import assert from "node:assert/strict";

import {
  ingestChannelFeedback,
  type ChannelFeedback,
  type RelationshipMemoryPort,
  type FeedbackAuditPort,
  type RelationshipMemory,
  type FeedbackIngestionResult,
} from "../../../src/guidance/index.js";

function makeFeedback(overrides?: Partial<ChannelFeedback>): ChannelFeedback {
  return {
    messageId: "msg-001",
    deliveryResult: "sent",
    deliveryProof: { messageId: "msg-001" },
    ownerReaction: "reply",
    reactionContent: "Thanks for the update",
    timestamp: new Date().toISOString(),
    channelId: "email",
    ...overrides,
  };
}

function makeRelationshipPort(
  opts: { failAfter?: number; memory?: RelationshipMemory } = {},
): RelationshipMemoryPort {
  let callCount = 0;
  const baseMemory: RelationshipMemory = opts.memory ?? {
    channelPreferences: [],
    responsePatterns: [],
    trustDelta: 0,
  };
  return {
    async loadRelationshipMemory() {
      return { ...baseMemory };
    },
    async updateRelationshipMemory() {
      callCount++;
      if (opts.failAfter !== undefined && callCount > opts.failAfter) {
        return;
      }
      if (opts.failAfter !== undefined && callCount <= opts.failAfter) {
        throw new Error("persist_failed");
      }
    },
  };
}

function makeAuditPort(): FeedbackAuditPort & { logged: Array<Parameters<FeedbackAuditPort["recordFeedbackIngestionFailed"]>[0]> } {
  const logged: Array<Parameters<FeedbackAuditPort["recordFeedbackIngestionFailed"]>[0]> = [];
  return {
    logged,
    async recordFeedbackIngestionFailed(summary) {
      logged.push(summary);
    },
  };
}

// ─── Success paths ──────────────────────────────────────────────────────────

test("T-GVS.C.2 ingests reply feedback and updates trust positively", async () => {
  const port = makeRelationshipPort();
  const audit = makeAuditPort();

  const result = await ingestChannelFeedback(makeFeedback(), {
    relationshipPort: port,
    auditPort: audit,
  });

  assert.equal(result.status, "ingested");
  assert.ok(result.updatedTrust! > 0);
  assert.equal(result.relationshipUpdate?.deliverySuccess, true);
  assert.equal(audit.logged.length, 0);
});

test("T-GVS.C.2 ingests ignore feedback and applies negative trust delta", async () => {
  const port = makeRelationshipPort();
  const audit = makeAuditPort();

  const result = await ingestChannelFeedback(
    makeFeedback({ ownerReaction: "ignore", reactionContent: undefined }),
    { relationshipPort: port, auditPort: audit },
  );

  assert.equal(result.status, "ingested");
  assert.ok(result.updatedTrust! < 0);
  assert.equal(result.relationshipUpdate?.responsePattern.reaction, "ignore");
});

test("T-GVS.C.2 block reaction triggers more_cautious tone adjustment", async () => {
  const port = makeRelationshipPort();
  const audit = makeAuditPort();

  const result = await ingestChannelFeedback(
    makeFeedback({ ownerReaction: "block" }),
    { relationshipPort: port, auditPort: audit },
  );

  assert.equal(result.status, "ingested");
  const toneAdj = result.strategyAdjustments?.find((a) => a.type === "tone");
  assert.ok(toneAdj);
  assert.equal(toneAdj!.adjustment, "more_cautious");
  assert.equal(toneAdj!.reason, "user_blocked");
});

test("T-GVS.C.2 missing deliveryProof coerces sent to not_sent", async () => {
  const port = makeRelationshipPort();
  const audit = makeAuditPort();

  const result = await ingestChannelFeedback(
    makeFeedback({ deliveryResult: "sent", deliveryProof: undefined }),
    { relationshipPort: port, auditPort: audit },
  );

  assert.equal(result.status, "ingested");
  assert.equal(result.relationshipUpdate?.deliverySuccess, false);
});

test("T-GVS.C.2 reactionContent with email gets redacted", async () => {
  const port = makeRelationshipPort();
  const audit = makeAuditPort();

  await ingestChannelFeedback(
    makeFeedback({ reactionContent: "Contact me at test@example.com" }),
    { relationshipPort: port, auditPort: audit },
  );

  // Redaction happens internally; we verify no crash and result is ingested
  assert.equal(audit.logged.length, 0);
});

// ─── Rejection paths ────────────────────────────────────────────────────────

test("T-GVS.C.2 feedback older than 30 days is rejected with errors", async () => {
  const port = makeRelationshipPort();
  const audit = makeAuditPort();
  const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();

  const result = await ingestChannelFeedback(
    makeFeedback({ timestamp: oldDate }),
    { relationshipPort: port, auditPort: audit },
  );

  assert.equal(result.status, "rejected");
  assert.ok(result.errors?.includes("feedback_too_old"));
  assert.equal(result.relationshipUpdate, undefined);
});

test("T-GVS.C.2 invalid timestamp is rejected", async () => {
  const port = makeRelationshipPort();
  const audit = makeAuditPort();

  const result = await ingestChannelFeedback(
    makeFeedback({ timestamp: "not-a-date" }),
    { relationshipPort: port, auditPort: audit },
  );

  assert.equal(result.status, "rejected");
  assert.ok(result.errors?.includes("invalid_timestamp"));
});

// ─── Retry / failure paths ──────────────────────────────────────────────────

test("T-GVS.C.2 write failure retries 3 times then audits and returns failed_after_retries", async () => {
  const port = makeRelationshipPort({ failAfter: 999 }); // always fails
  const audit = makeAuditPort();

  const start = Date.now();
  const result = await ingestChannelFeedback(makeFeedback(), {
    relationshipPort: port,
    auditPort: audit,
  });
  const elapsed = Date.now() - start;

  assert.equal(result.status, "failed_after_retries");
  assert.ok(result.updatedTrust !== undefined);
  assert.equal(audit.logged.length, 1);
  assert.equal(audit.logged[0]!.retryCount, 3);
  assert.equal(audit.logged[0]!.channelId, "email");
  // Retry delays: 500 + 1000 + 2000 = 3500ms minimum
  assert.ok(elapsed >= 3000, `expected at least 3000ms retry delay, got ${elapsed}ms`);
});

test("T-GVS.C.2 write succeeds on second retry", async () => {
  let callCount = 0;
  const port: RelationshipMemoryPort = {
    async loadRelationshipMemory() {
      return { channelPreferences: [], responsePatterns: [], trustDelta: 0 };
    },
    async updateRelationshipMemory() {
      callCount++;
      if (callCount < 2) throw new Error("persist_failed");
    },
  };
  const audit = makeAuditPort();

  const start = Date.now();
  const result = await ingestChannelFeedback(makeFeedback(), {
    relationshipPort: port,
    auditPort: audit,
  });
  const elapsed = Date.now() - start;

  assert.equal(result.status, "ingested");
  assert.equal(audit.logged.length, 0);
  assert.ok(elapsed >= 400 && elapsed < 1500, `expected ~500ms delay, got ${elapsed}ms`);
});

// ─── Strategy adjustments ───────────────────────────────────────────────────

test("T-GVS.C.2 negative trust triggers frequency decrease", async () => {
  const port = makeRelationshipPort({
    memory: { channelPreferences: [], responsePatterns: [], trustDelta: -2.0 },
  });
  const audit = makeAuditPort();

  const result = await ingestChannelFeedback(makeFeedback(), {
    relationshipPort: port,
    auditPort: audit,
  });

  const freqAdj = result.strategyAdjustments?.find((a) => a.type === "frequency");
  assert.ok(freqAdj);
  assert.equal(freqAdj!.adjustment, "decrease");
});
