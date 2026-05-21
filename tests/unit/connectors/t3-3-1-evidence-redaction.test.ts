/**
 * T3.3.1 — Evidence mapper redaction unit tests.
 *
 * Covers mapLifeEvidence sensitivity boundaries:
 * - message.send intent → null (private, excluded)
 * - comment.reply intent → null (private, excluded)
 * - public intent with sourceRefs → candidate with sensitivity public
 * - sensitivity override honoured
 */
import test from "node:test";
import assert from "node:assert/strict";

import { mapLifeEvidence } from "../../../src/connectors/base/map-life-evidence.js";
import type { ConnectorResult } from "../../../src/connectors/base/contract.js";

test("T3.3.1 message.send intent is excluded regardless of data", () => {
  const result: ConnectorResult<unknown> = {
    status: "success",
    data: {
      sourceRefs: [{ id: "msg-1", kind: "message", uri: "platform://moltbook/msg/1" }],
    },
    metadata: { platformId: "moltbook", channel: "api_rest", latencyMs: 1 },
  };
  const candidate = mapLifeEvidence({
    platformId: "moltbook",
    intent: "message.send",
    result,
    observedAt: "2026-05-02T00:00:00.000Z",
  });
  assert.equal(candidate, null);
});

test("T3.3.1 comment.reply intent is excluded", () => {
  const result: ConnectorResult<unknown> = {
    status: "success",
    data: {
      sourceRefs: [{ id: "cmt-1", kind: "comment", uri: "platform://moltbook/comment/1" }],
    },
    metadata: { platformId: "moltbook", channel: "api_rest", latencyMs: 1 },
  };
  const candidate = mapLifeEvidence({
    platformId: "moltbook",
    intent: "comment.reply",
    result,
    observedAt: "2026-05-02T00:00:00.000Z",
  });
  assert.equal(candidate, null);
});

test("T3.3.1 public intent with sourceRefs returns public sensitivity", () => {
  const result: ConnectorResult<unknown> = {
    status: "success",
    data: {
      sourceRefs: [{ id: "ref-1", kind: "platform_item", uri: "platform://moltbook/item/1" }],
    },
    metadata: { platformId: "moltbook", channel: "api_rest", latencyMs: 1 },
  };
  const candidate = mapLifeEvidence({
    platformId: "moltbook",
    intent: "feed.read",
    result,
    observedAt: "2026-05-02T00:00:00.000Z",
  });
  assert.ok(candidate);
  assert.equal(candidate!.sensitivity, "public");
});

test("T3.3.1 sensitivityOverride is honoured", () => {
  const result: ConnectorResult<unknown> = {
    status: "success",
    data: {
      sourceRefs: [{ id: "ref-1", kind: "platform_item", uri: "platform://moltbook/item/1" }],
    },
    metadata: { platformId: "moltbook", channel: "api_rest", latencyMs: 1 },
  };
  const candidate = mapLifeEvidence({
    platformId: "moltbook",
    intent: "feed.read",
    result,
    observedAt: "2026-05-02T00:00:00.000Z",
    sensitivityOverride: "private",
  });
  assert.ok(candidate);
  assert.equal(candidate!.sensitivity, "private");
});

test("T3.3.1 unknown intent without evidenceType mapping returns null", () => {
  const result: ConnectorResult<unknown> = {
    status: "success",
    data: {
      sourceRefs: [{ id: "ref-1", kind: "platform_item", uri: "platform://moltbook/item/1" }],
    },
    metadata: { platformId: "moltbook", channel: "api_rest", latencyMs: 1 },
  };
  const candidate = mapLifeEvidence({
    platformId: "moltbook",
    intent: "unknown.action" as any,
    result,
    observedAt: "2026-05-02T00:00:00.000Z",
  });
  assert.equal(candidate, null);
});
