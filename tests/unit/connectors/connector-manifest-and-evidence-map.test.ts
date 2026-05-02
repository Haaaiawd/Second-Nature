import test from "node:test";
import assert from "node:assert/strict";

import {
  CapabilityContractRegistry,
  checkConnector,
  describeConnector,
  discoverCapabilities,
  parseConnectorManifest,
} from "../../../src/connectors/base/manifest.js";
import { mapLifeEvidence } from "../../../src/connectors/base/map-life-evidence.js";
import type { ConnectorResult } from "../../../src/connectors/base/contract.js";

test("T3.1.1 describeConnector / checkConnector / discoverCapabilities", () => {
  const registry = new CapabilityContractRegistry();
  const manifest = parseConnectorManifest({
    platformId: "fixture-platform",
    supportedCapabilities: ["feed.read", "work.discover"],
    channelPriority: ["api_rest", "skill"],
    credentialTypes: ["api_key"],
    degradedChannels: ["skill"],
    sourceRefPolicy: { minSourceRefs: 1 },
  });
  registry.register(manifest);

  const described = describeConnector(registry, "fixture-platform");
  assert.equal(described.platformId, "fixture-platform");

  const ok = checkConnector(registry, "fixture-platform");
  assert.equal(ok.ok, true);
  assert.equal(ok.errors.length, 0);

  const bad = checkConnector(registry, "missing");
  assert.equal(bad.ok, false);

  const disc = discoverCapabilities(registry);
  assert.equal(disc.length, 1);
  assert.ok(disc[0]!.capabilities.includes("feed.read"));
});

test("T3.1.1 checkConnector rejects degraded channel outside priority", () => {
  const registry = new CapabilityContractRegistry();
  registry.register(
    parseConnectorManifest({
      platformId: "bad-degraded",
      supportedCapabilities: ["feed.read"],
      channelPriority: ["api_rest"],
      credentialTypes: ["api_key"],
      degradedChannels: ["browser"],
    }),
  );
  const r = checkConnector(registry, "bad-degraded");
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes("degraded_channel_not_in_priority")));
});

test("T3.1.2 mapLifeEvidence maps feed.read success with items to platform_browse", () => {
  const result: ConnectorResult<unknown> = {
    status: "success",
    data: { items: [{ id: "p1" }, { id: "p2" }] },
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
  assert.ok(candidate!.sourceRefs.length >= 1);
});

test("T3.1.2 mapLifeEvidence returns null for message.send", () => {
  const result: ConnectorResult<unknown> = {
    status: "success",
    data: { items: [{ id: "x" }] },
    metadata: { platformId: "x", channel: "api_rest", latencyMs: 1 },
  };
  assert.equal(
    mapLifeEvidence({ platformId: "x", intent: "message.send", result, observedAt: "2026-05-02T00:00:00.000Z" }),
    null,
  );
});

test("T3.1.2 mapLifeEvidence returns null when no extractable source refs", () => {
  const result: ConnectorResult<unknown> = {
    status: "success",
    data: {},
    metadata: { platformId: "moltbook", channel: "api_rest", latencyMs: 1 },
  };
  assert.equal(
    mapLifeEvidence({ platformId: "moltbook", intent: "feed.read", result, observedAt: "2026-05-02T00:00:00.000Z" }),
    null,
  );
});
