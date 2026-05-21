/**
 * T2.4.1 — Platform-specific intent credential-route unit tests.
 *
 * Covers resolvePlatformForIntent when registry is present but the
 * resolved platform does not support the required capability (credential
 * route unavailable), or when no registry is present.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { resolvePlatformForIntent } from "../../../src/core/second-nature/orchestrator/platform-capability-router.js";
import { CapabilityContractRegistry } from "../../../src/connectors/base/manifest.js";

test("T2.4.1-C: registry present but platform lacks capability → undefined", () => {
  const registry = new CapabilityContractRegistry();
  registry.register({
    platformId: "moltbook",
    supportedCapabilities: ["feed.read"],
    channelPriority: ["api_rest"],
    credentialTypes: ["api_key"],
    sourceRefPolicy: { minSourceRefs: 1 },
  });

  // "work" maps to "work.discover", which moltbook does NOT support
  const result = resolvePlatformForIntent(
    "work",
    { acceptedGoals: [{ goalId: "g1", description: "work on moltbook" }] },
    registry,
  );
  assert.equal(result, undefined);
});

test("T2.4.1-C: registry present and platform supports capability → platformId", () => {
  const registry = new CapabilityContractRegistry();
  registry.register({
    platformId: "moltbook",
    supportedCapabilities: ["feed.read"],
    channelPriority: ["api_rest"],
    credentialTypes: ["api_key"],
    sourceRefPolicy: { minSourceRefs: 1 },
  });

  // "exploration" maps to "feed.read", which moltbook supports
  const result = resolvePlatformForIntent(
    "exploration",
    { acceptedGoals: [{ goalId: "g1", description: "explore moltbook" }] },
    registry,
  );
  assert.equal(result, "moltbook");
});

test("T2.4.1-D: no registry + goal names platform → best-effort platformId", () => {
  const result = resolvePlatformForIntent(
    "exploration",
    { acceptedGoals: [{ goalId: "g1", description: "explore moltbook feed" }] },
    undefined,
  );
  assert.equal(result, "moltbook");
});

test("T2.4.1-D: no registry + ambiguous goals → undefined", () => {
  const result = resolvePlatformForIntent(
    "exploration",
    {
      acceptedGoals: [
        { goalId: "g1", description: "explore moltbook" },
        { goalId: "g2", description: "explore instreet" },
      ],
    },
    undefined,
  );
  assert.equal(result, undefined);
});

test("T2.4.1-E: no registry + evidence refs name platform → platformId", () => {
  const result = resolvePlatformForIntent(
    "exploration",
    {
      evidenceRefs: [
        { id: "ev-1", kind: "platform_item", uri: "platform://moltbook/item/1" },
      ],
    },
    undefined,
  );
  assert.equal(result, "moltbook");
});

test("T2.4.1-E: registry + unsupported capability via evidence → undefined", () => {
  const registry = new CapabilityContractRegistry();
  registry.register({
    platformId: "moltbook",
    supportedCapabilities: ["feed.read"],
    channelPriority: ["api_rest"],
    credentialTypes: ["api_key"],
    sourceRefPolicy: { minSourceRefs: 1 },
  });

  // evidence names moltbook, but "work" → "work.discover" is unsupported
  const result = resolvePlatformForIntent(
    "work",
    {
      evidenceRefs: [
        { id: "ev-1", kind: "platform_item", uri: "platform://moltbook/item/1" },
      ],
    },
    registry,
  );
  assert.equal(result, undefined);
});
