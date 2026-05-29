/**
 * T3.3.1 — Evidence mapper unit tests.
 *
 * Covers mapLifeEvidence boundary behaviours:
 * - success with sourceRefs → candidate
 * - empty data → null
 * - failure status → null
 * - missing sourceRefs → null
 */
import test from "node:test";
import assert from "node:assert/strict";

import { mapLifeEvidence } from "../../../src/connectors/base/map-life-evidence.js";
import type { ConnectorResult } from "../../../src/connectors/base/contract.js";

test("T3.3.1 success result with sourceRefs maps to LifeEvidenceCandidate", () => {
  const result: ConnectorResult<unknown> = {
    status: "success",
    data: {
      sourceRefs: [
        { id: "ref-1", kind: "platform_item", uri: "platform://moltbook/item/ref-1" },
      ],
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
  assert.equal(candidate!.evidenceType, "platform_browse");
  assert.equal(candidate!.sourceRefs.length, 1);
  assert.equal(candidate!.sourceRefs[0]!.id, "ref-1");
});

test("T3.3.1 empty data returns null", () => {
  const result: ConnectorResult<unknown> = {
    status: "success",
    data: {},
    metadata: { platformId: "moltbook", channel: "api_rest", latencyMs: 1 },
  };
  const candidate = mapLifeEvidence({
    platformId: "moltbook",
    intent: "feed.read",
    result,
    observedAt: "2026-05-02T00:00:00.000Z",
  });
  assert.equal(candidate, null);
});

test("T3.3.1 policy-wrapped connector payload maps nested data items", () => {
  const result: ConnectorResult<unknown> = {
    status: "success",
    data: {
      capability: "feed.read",
      channel: "api_rest",
      data: {
        items: [
          { id: "post-001", title: "Nested connector item" },
        ],
      },
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
  assert.equal(candidate!.sourceRefs[0]!.id, "post-001");
});

test("T3.3.1 failure status returns null", () => {
  const result: ConnectorResult<unknown> = {
    status: "terminal_failure",
    failureClass: "auth_failure",
    metadata: { platformId: "moltbook", channel: "api_rest", latencyMs: 1 },
  };
  const candidate = mapLifeEvidence({
    platformId: "moltbook",
    intent: "feed.read",
    result,
    observedAt: "2026-05-02T00:00:00.000Z",
  });
  assert.equal(candidate, null);
});

test("T3.3.1 missing sourceRefs returns null", () => {
  const result: ConnectorResult<unknown> = {
    status: "success",
    data: { items: [] },
    metadata: { platformId: "moltbook", channel: "api_rest", latencyMs: 1 },
  };
  const candidate = mapLifeEvidence({
    platformId: "moltbook",
    intent: "feed.read",
    result,
    observedAt: "2026-05-02T00:00:00.000Z",
  });
  assert.equal(candidate, null);
});

// ── T-CS.C.7 Platform array recognition (Wave 85) ──

test("T-CS.C.7 moltbook posts array generates sourceRefs", () => {
  const result: ConnectorResult<unknown> = {
    status: "success",
    data: {
      posts: [
        { id: "post-a", title: "Hello", url: "https://moltbook.example/p/post-a" },
        { id: "post-b", title: "World" },
      ],
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
  assert.equal(candidate!.sourceRefs.length, 2);
  assert.equal(candidate!.sourceRefs[0]!.id, "post-a");
  assert.equal(candidate!.sourceRefs[0]!.uri, "https://moltbook.example/p/post-a");
  assert.equal(candidate!.sourceRefs[1]!.id, "post-b");
  assert.equal(candidate!.sourceRefs[1]!.uri, "platform://moltbook/item/post-b");
});

test("T-CS.C.7 agent-world agents array generates sourceRefs", () => {
  const result: ConnectorResult<unknown> = {
    status: "success",
    data: {
      agents: [{ id: "agent-1" }, { id: "agent-2" }],
    },
    metadata: { platformId: "agent-world", channel: "api_rest", latencyMs: 1 },
  };
  const candidate = mapLifeEvidence({
    platformId: "agent-world",
    intent: "feed.read",
    result,
    observedAt: "2026-05-02T00:00:00.000Z",
  });
  assert.ok(candidate);
  assert.equal(candidate!.sourceRefs.length, 2);
  assert.equal(candidate!.sourceRefs[0]!.id, "agent-1");
  assert.equal(candidate!.sourceRefs[1]!.id, "agent-2");
});

test("T-CS.C.7 deeply nested data posts array is reached through recursion", () => {
  const result: ConnectorResult<unknown> = {
    status: "success",
    data: {
      capability: "feed.read",
      channel: "api_rest",
      data: {
        posts: [{ id: "deep-1", url: "https://example.com/1" }],
      },
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
  assert.equal(candidate!.sourceRefs.length, 1);
  assert.equal(candidate!.sourceRefs[0]!.id, "deep-1");
});

test("T-CS.C.7 legacy sourceRefs path still works (regression)", () => {
  const result: ConnectorResult<unknown> = {
    status: "success",
    data: {
      sourceRefs: [
        { id: "legacy-1", kind: "platform_item", uri: "platform://legacy/item/1" },
      ],
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
  assert.equal(candidate!.sourceRefs[0]!.id, "legacy-1");
});

test("T-CS.C.7 legacy items path still works (regression)", () => {
  const result: ConnectorResult<unknown> = {
    status: "success",
    data: { items: [{ id: "item-1" }] },
    metadata: { platformId: "moltbook", channel: "api_rest", latencyMs: 1 },
  };
  const candidate = mapLifeEvidence({
    platformId: "moltbook",
    intent: "feed.read",
    result,
    observedAt: "2026-05-02T00:00:00.000Z",
  });
  assert.ok(candidate);
  assert.equal(candidate!.sourceRefs[0]!.id, "item-1");
});
