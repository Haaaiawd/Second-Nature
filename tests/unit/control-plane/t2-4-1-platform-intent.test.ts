/**
 * T2.4.1 — Platform-specific intent resolution unit tests.
 *
 * Acceptance:
 * A. accepted goal names a known platform → intent gets platformId.
 * B. evidence refs name a known platform → intent gets platformId.
 * C. registry validates capability; unsupported platform falls through.
 * D. ambiguous / no signal → platformId remains undefined.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { resolvePlatformForIntent } from "../../../src/core/second-nature/orchestrator/platform-capability-router.js";
import { CapabilityContractRegistry } from "../../../src/connectors/base/manifest.js";
import type { AgentGoal } from "../../../src/storage/goal/agent-goal-store.js";

function makeGoal(description: string, completionCriteria?: string): AgentGoal {
  return {
    goalId: `goal-${Math.random().toString(36).slice(2)}`,
    kind: "short_term",
    description,
    completionCriteria: completionCriteria ?? "",
    status: "accepted",
    origin: "owner_set",
    acceptedBy: "owner",
    risk: "low",
    priorityHint: 50,
    sourceRefs: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildRegistry(): CapabilityContractRegistry {
  const r = new CapabilityContractRegistry();
  r.register({
    platformId: "moltbook",
    supportedCapabilities: ["feed.read", "comment.reply"],
    channelPriority: ["api_rest"],
    credentialTypes: ["api_key"],
    sourceRefPolicy: { minSourceRefs: 1 },
  });
  r.register({
    platformId: "evomap",
    supportedCapabilities: ["work.discover", "task.claim"],
    channelPriority: ["api_rest"],
    credentialTypes: ["api_key"],
    sourceRefPolicy: { minSourceRefs: 1 },
  });
  return r;
}

test("T2.4.1-A: goal names moltbook → exploration resolves platformId=moltbook", () => {
  const platformId = resolvePlatformForIntent("exploration", {
    acceptedGoals: [makeGoal("Explore new opportunities on moltbook")],
  });
  assert.equal(platformId, "moltbook");
});

test("T2.4.1-A: goal names evomap → work resolves platformId=evomap", () => {
  const platformId = resolvePlatformForIntent("work", {
    acceptedGoals: [makeGoal("Find tasks on evomap")],
  });
  assert.equal(platformId, "evomap");
});

test("T2.4.1-B: evidence ref with connector_result id containing moltbook → social resolves platformId=moltbook", () => {
  const platformId = resolvePlatformForIntent("social", {
    evidenceRefs: [
      {
        id: "moltbook-post-001",
        kind: "connector_result",
        uri: "platform://moltbook/item/moltbook-post-001",
      },
    ],
  });
  assert.equal(platformId, "moltbook");
});

test("T2.4.1-B: evidence ref uri platform://evomap → work resolves platformId=evomap", () => {
  const platformId = resolvePlatformForIntent("work", {
    evidenceRefs: [
      {
        id: "ref-1",
        kind: "workspace_artifact",
        uri: "platform://evomap/work/discovery",
      },
    ],
  });
  assert.equal(platformId, "evomap");
});

test("T2.4.1-C: registry validates capability; unsupported capability returns undefined", () => {
  const registry = buildRegistry();
  // evomap supports work.discover but NOT feed.read (exploration)
  const platformId = resolvePlatformForIntent(
    "exploration",
    {
      acceptedGoals: [makeGoal("Check evomap feed")],
    },
    registry,
  );
  // With registry, unsupported capability → undefined (guard layer denies)
  assert.equal(platformId, undefined);
});

test("T2.4.1-C: registry validates supported capability → returns validated platform", () => {
  const registry = buildRegistry();
  const platformId = resolvePlatformForIntent(
    "exploration",
    {
      acceptedGoals: [makeGoal("Read moltbook feed")],
    },
    registry,
  );
  assert.equal(platformId, "moltbook");
});

test("T2.4.1-D: no goals, no evidence → platformId undefined", () => {
  const platformId = resolvePlatformForIntent("exploration", {});
  assert.equal(platformId, undefined);
});

test("T2.4.1-D: goal mentions unknown platform → platformId undefined", () => {
  const platformId = resolvePlatformForIntent("exploration", {
    acceptedGoals: [makeGoal("Explore new opportunities on unknownplatform")],
  });
  assert.equal(platformId, undefined);
});

test("T2.4.1-D: goal and evidence point to different platforms → ambiguous, returns undefined", () => {
  const platformId = resolvePlatformForIntent("exploration", {
    acceptedGoals: [makeGoal("Look at moltbook")],
    evidenceRefs: [
      {
        id: "evomap-task-001",
        kind: "connector_result",
        uri: "platform://evomap/task/001",
      },
    ],
  });
  // Multiple distinct platforms → ambiguous, return undefined (guard layer denies)
  assert.equal(platformId, undefined);
});

test("T2.4.1-E: dynamic registry includes new platform → resolves new platformId", () => {
  const registry = new CapabilityContractRegistry();
  registry.register({
    platformId: "agentworld",
    supportedCapabilities: ["feed.read"],
    channelPriority: ["api_rest"],
    credentialTypes: ["api_key"],
    sourceRefPolicy: { minSourceRefs: 1 },
  });
  const platformId = resolvePlatformForIntent(
    "exploration",
    {
      acceptedGoals: [makeGoal("Explore agentworld")],
    },
    registry,
  );
  assert.equal(platformId, "agentworld");
});

test("T2.4.1-F: no registry, unknown platform → undefined (not in built-in fallback)", () => {
  const platformId = resolvePlatformForIntent("exploration", {
    acceptedGoals: [makeGoal("Explore agentworld")],
  });
  // Without registry, built-in fallback only knows packaged connector ids.
  assert.equal(platformId, undefined);
});

test("T2.4.1-F: no registry still rejects unsupported fallback capability", () => {
  const platformId = resolvePlatformForIntent("work", {
    acceptedGoals: [makeGoal("work on moltbook")],
  });
  assert.equal(platformId, undefined);
});

test("T2.4.1: priority order: work → exploration → social → outreach → quiet", () => {
  // kindToCapability mapping verification
  assert.equal(resolvePlatformForIntent("work", {
    acceptedGoals: [makeGoal("evomap tasks")],
  }), "evomap");
  assert.equal(resolvePlatformForIntent("exploration", {
    acceptedGoals: [makeGoal("moltbook feed")],
  }), "moltbook");
  assert.equal(resolvePlatformForIntent("social", {
    acceptedGoals: [makeGoal("moltbook social")],
  }), "moltbook");
  assert.equal(resolvePlatformForIntent("outreach", {
    acceptedGoals: [makeGoal("message on moltbook")],
  }), "moltbook");
  assert.equal(resolvePlatformForIntent("quiet", {
    acceptedGoals: [makeGoal("quiet on moltbook")],
  }), undefined);
});
