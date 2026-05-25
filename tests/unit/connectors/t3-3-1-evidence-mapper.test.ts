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
