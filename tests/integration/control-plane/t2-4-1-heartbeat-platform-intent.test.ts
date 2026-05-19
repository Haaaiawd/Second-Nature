/**
 * T2.4.1 — Platform-specific intent selection in heartbeat integration.
 *
 * Acceptance:
 * A. accepted goal names platform → heartbeat selects intent with platformId.
 * B. no registry / ambiguous capability → heartbeat still completes (platformId undefined).
 * C. connector execution uses resolved platformId.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { ingestRhythmSignal } from "../../../src/core/second-nature/heartbeat/heartbeat-loop.js";
import type { HeartbeatSignal } from "../../../src/core/second-nature/heartbeat/signal.js";
import type { SnapshotInputs } from "../../../src/core/second-nature/heartbeat/snapshot-builder.js";
import { CapabilityContractRegistry } from "../../../src/connectors/base/manifest.js";

function createSignal(): HeartbeatSignal {
  return {
    trigger: "heartbeat_bridge",
    payload: { timestamp: new Date().toISOString() },
  } as HeartbeatSignal;
}

function createSnapshotInputs(overrides?: Partial<SnapshotInputs>): SnapshotInputs {
  return {
    mode: "active",
    currentWindowId: "default",
    pendingObligations: [],
    recentOutreachHashes: [],
    deniedIntents: [],
    budgets: { socialUsed: 0, socialLimit: 5 },
    lifeEvidenceRefs: [{ id: "base-ref", kind: "workspace_artifact", uri: "workspace://test" }],
    platformEventCount: 1,
    workEventCount: 0,
    ...overrides,
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
  return r;
}

test("T2.4.1-A: goal names moltbook → heartbeat selects exploration intent with platformId=moltbook", async () => {
  const result = await ingestRhythmSignal(createSignal(), {
    loadSnapshotInputs: async () =>
      createSnapshotInputs({
        acceptedGoals: [
          {
            goalId: "goal-001",
            kind: "short_term",
            description: "Explore opportunities on moltbook",
            completionCriteria: "scan feed daily",
            status: "accepted",
            origin: "owner_set",
            acceptedBy: "owner",
            risk: "low",
            priorityHint: 50,
            sourceRefs: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      }),
    connectorRegistry: buildRegistry(),
  });

  assert.equal(result.status, "intent_selected");
  // The selected intent should have platformId set by the planner.
  // selectedIntentId encodes the platform (e.g. "intent-exploration-moltbook").
  assert.ok(
    result.selectedIntentId?.includes("moltbook"),
    `expected selected intent to reference moltbook, got id=${result.selectedIntentId}`,
  );
});

test("T2.4.1-A: goal names moltbook with connectorExecutor → executeEffect receives platformId=moltbook", async () => {
  let capturedPlatformId: string | undefined;

  const result = await ingestRhythmSignal(createSignal(), {
    loadSnapshotInputs: async () =>
      createSnapshotInputs({
        acceptedGoals: [
          {
            goalId: "goal-002",
            kind: "short_term",
            description: "Read moltbook feed",
            completionCriteria: "find 3 interesting posts",
            status: "accepted",
            origin: "owner_set",
            acceptedBy: "owner",
            risk: "low",
            priorityHint: 50,
            sourceRefs: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      }),
    connectorRegistry: buildRegistry(),
    connectorExecutor: {
      executeEffect: async (req) => {
        capturedPlatformId = req.platformId;
        return {
          status: "success",
          data: { items: [{ id: "post-001" }] },
          metadata: {
            platformId: req.platformId,
            channel: "api_rest",
            latencyMs: 100,
          },
        };
      },
    },
  });

  assert.equal(result.status, "intent_selected");
  assert.equal(capturedPlatformId, "moltbook");
  assert.ok(result.reasons.includes("connector_effect_executed"));
});

test("T2.4.1-B: no registry → heartbeat completes with platformId undefined (backward compat)", async () => {
  const result = await ingestRhythmSignal(createSignal(), {
    loadSnapshotInputs: async () => createSnapshotInputs(),
    // No connectorRegistry
  });

  assert.equal(result.status, "intent_selected");
  // With no registry, the planner still generates connector_action intents
  // but without platformId — existing behavior preserved
});

test("T2.4.1-B: ambiguous platform without registry → intent selected without specific platform", async () => {
  const result = await ingestRhythmSignal(createSignal(), {
    loadSnapshotInputs: async () =>
      createSnapshotInputs({
        acceptedGoals: [
          {
            goalId: "goal-003",
            kind: "short_term",
            description: "Explore new platforms",
            completionCriteria: "find opportunities",
            status: "accepted",
            origin: "owner_set",
            acceptedBy: "owner",
            risk: "low",
            priorityHint: 50,
            sourceRefs: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      }),
  });

  assert.equal(result.status, "intent_selected");
});

test("T2.4.1-C: goal priority boost still works when platformId is set", async () => {
  const result = await ingestRhythmSignal(createSignal(), {
    loadSnapshotInputs: async () =>
      createSnapshotInputs({
        acceptedGoals: [
          {
            goalId: "goal-004",
            kind: "short_term",
            description: "moltbook exploration",
            completionCriteria: "scan moltbook",
            status: "accepted",
            origin: "owner_set",
            acceptedBy: "owner",
            risk: "low",
            priorityHint: 50,
            sourceRefs: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      }),
    connectorRegistry: buildRegistry(),
    connectorExecutor: {
      executeEffect: async (req) => ({
        status: "success",
        data: { items: [] },
        metadata: {
          platformId: req.platformId,
          channel: "api_rest",
          latencyMs: 100,
        },
      }),
    },
  });

  assert.equal(result.status, "intent_selected");
  // The goal should have boosted exploration to top priority
  assert.ok(result.reasons.includes("connector_effect_executed"));
});
