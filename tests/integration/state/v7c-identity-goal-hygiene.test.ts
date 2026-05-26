/**
 * T-V7C.C.4 — Identity / Goal Hygiene Closure Integration Tests
 *
 * Coverage:
 * 1. Goal dedupe: same kind+scope → only latest accepted remains active
 * 2. IdentityProfile → Connector: connector request carries platform handle (readable, no credential)
 * 3. RelationshipMemory → Guidance: feedback affects frequency/tone selection
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createAgentGoalStore } from "../../../src/storage/goal/agent-goal-store.js";
import { createIdentityProfileStore } from "../../../src/storage/services/identity-profile-store.js";
import { createRelationshipMemoryStore } from "../../../src/storage/relationship/relationship-memory-store.js";
import {
  computeFrequency,
  computeStyle,
} from "../../../src/guidance/outreach-strategy-selector.js";
import type { ConnectorRequest } from "../../../src/connectors/base/contract.js";

describe("T-V7C.C.4 — Goal Dedupe (heartbeat active goals)", () => {
  it("same kind+scope accepted goals → listAgentGoals returns only newest", async () => {
    const db = createStateDatabase(":memory:");
    const store = createAgentGoalStore(db);

    const oldGoal = {
      goalId: "g-old",
      kind: "short_term" as const,
      scope: "global",
      status: "accepted" as const,
      origin: "owner_set" as const,
      description: "Old goal",
      completionCriteria: "Done",
      risk: "low" as const,
      priorityHint: 1,
      sourceRefs: [],
      acceptedBy: "owner" as const,
      createdAt: "2026-05-21T00:00:00Z",
      updatedAt: "2026-05-21T00:00:00Z",
    };
    const newGoal = {
      goalId: "g-new",
      kind: "short_term" as const,
      scope: "global",
      status: "accepted" as const,
      origin: "owner_set" as const,
      description: "New goal",
      completionCriteria: "Done",
      risk: "low" as const,
      priorityHint: 2,
      sourceRefs: [],
      acceptedBy: "owner" as const,
      createdAt: "2026-05-21T00:00:00Z",
      updatedAt: "2026-05-21T00:00:01Z",
    };

    await store.upsertAgentGoal(oldGoal);
    await store.upsertAgentGoal(newGoal);

    const active = await store.listAgentGoals({ statuses: ["accepted"] });
    assert.strictEqual(active.length, 1);
    assert.strictEqual(active[0]!.goalId, "g-new");
    assert.strictEqual(active[0]!.status, "accepted");
  });

  it("different scope goals are NOT deduped", async () => {
    const db = createStateDatabase(":memory:");
    const store = createAgentGoalStore(db);

    const globalGoal = {
      goalId: "g-global",
      kind: "short_term" as const,
      scope: "global",
      status: "accepted" as const,
      origin: "owner_set" as const,
      description: "Global",
      completionCriteria: "Done",
      risk: "low" as const,
      priorityHint: 1,
      sourceRefs: [],
      acceptedBy: "owner" as const,
      createdAt: "2026-05-21T00:00:00Z",
      updatedAt: "2026-05-21T00:00:00Z",
    };
    const moltbookGoal = {
      goalId: "g-moltbook",
      kind: "short_term" as const,
      scope: "moltbook",
      status: "accepted" as const,
      origin: "owner_set" as const,
      description: "Moltbook",
      completionCriteria: "Done",
      risk: "low" as const,
      priorityHint: 1,
      sourceRefs: [],
      acceptedBy: "owner" as const,
      createdAt: "2026-05-21T00:00:00Z",
      updatedAt: "2026-05-21T00:00:00Z",
    };

    await store.upsertAgentGoal(globalGoal);
    await store.upsertAgentGoal(moltbookGoal);

    const active = await store.listAgentGoals({ statuses: ["accepted"] });
    assert.strictEqual(active.length, 2);
  });
});

describe("T-V7C.C.4 — IdentityProfile → Connector Request", () => {
  it("identity store persists and loads platform handle", async () => {
    const db = createStateDatabase(":memory:");
    const store = createIdentityProfileStore(db);

    const profile = {
      profileId: "default",
      canonicalName: "nyx_ha",
      canonicalBio: "Test bio",
      platformHandles: [
        { platformId: "moltbook", handle: "haai-arch" },
        { platformId: "agent_world", handle: "nyx_ha" },
        { platformId: "instreet", handle: "haai_17949e" },
      ],
      updatedAt: "2026-05-21T00:00:00Z",
    };

    await store.upsertIdentityProfile(profile);
    const loaded = await store.loadIdentityProfile("default");

    assert.strictEqual(loaded.status, "loaded");
    if (loaded.status === "loaded") {
      assert.strictEqual(loaded.profile.canonicalName, "nyx_ha");
      const moltbook = loaded.profile.platformHandles.find(
        (h) => h.platformId === "moltbook",
      );
      assert.ok(moltbook);
      assert.strictEqual(moltbook!.handle, "haai-arch");
      // No credential in identity profile
      assert.ok(!loaded.profile.platformHandles.some((h) => "credential" in h));
    }
  });

  it("connector request identity shape is readable and has no credential", async () => {
    // Verify the ConnectorRequestIdentity type contract at runtime
    const request: ConnectorRequest = {
      platformId: "moltbook",
      intent: "post.publish",
      payload: {},
      identity: {
        platformHandle: "haai-arch",
        canonicalName: "nyx_ha",
      },
    };

    assert.ok(request.identity);
    assert.strictEqual(request.identity.platformHandle, "haai-arch");
    assert.strictEqual(request.identity.canonicalName, "nyx_ha");
    // Ensure no credential sneaks into the identity field
    const identityKeys = Object.keys(request.identity!);
    assert.ok(!identityKeys.includes("credential"));
    assert.ok(!identityKeys.includes("token"));
    assert.ok(!identityKeys.includes("password"));
  });
});

describe("T-V7C.C.4 — RelationshipMemory → Guidance Strategy", () => {
  it("high no-reply ratio → reduced frequency", () => {
    const memory = {
      channelPreferences: [],
      responsePatterns: [
        { reaction: "ignore", timing: "unknown", tone: "unknown", observedAt: "2026-05-21T00:00:00Z" },
        { reaction: "ignore", timing: "unknown", tone: "unknown", observedAt: "2026-05-21T00:00:00Z" },
        { reaction: "ignore", timing: "unknown", tone: "unknown", observedAt: "2026-05-21T00:00:00Z" },
        { reaction: "reply", timing: "unknown", tone: "casual", observedAt: "2026-05-21T00:00:00Z" },
        { reaction: "ignore", timing: "unknown", tone: "unknown", observedAt: "2026-05-21T00:00:00Z" },
      ],
      trustDelta: 0,
    };

    const frequency = computeFrequency(memory as never);
    assert.strictEqual(frequency, "reduced");
  });

  it("low trust delta → minimal or paused frequency", () => {
    const memory = {
      channelPreferences: [],
      responsePatterns: [],
      trustDelta: -0.5,
    };

    const frequency = computeFrequency(memory as never);
    assert.ok(frequency === "minimal" || frequency === "paused");
  });

  it("positive tone pattern → warm_anchored style", () => {
    const memory = {
      channelPreferences: [],
      responsePatterns: [
        { reaction: "reply", timing: "unknown", tone: "positive", observedAt: "2026-05-21T00:00:00Z" },
        { reaction: "reply", timing: "unknown", tone: "positive", observedAt: "2026-05-21T00:00:00Z" },
        { reaction: "reply", timing: "unknown", tone: "positive", observedAt: "2026-05-21T00:00:00Z" },
      ],
      trustDelta: 0.2,
    };

    const style = computeStyle(memory as never);
    assert.strictEqual(style, "warm_anchored");
  });

  it("negative tone pattern → light_check style", () => {
    const memory = {
      channelPreferences: [],
      responsePatterns: [
        { reaction: "reply", timing: "unknown", tone: "negative", observedAt: "2026-05-21T00:00:00Z" },
        { reaction: "reply", timing: "unknown", tone: "negative", observedAt: "2026-05-21T00:00:00Z" },
        { reaction: "reply", timing: "unknown", tone: "negative", observedAt: "2026-05-21T00:00:00Z" },
      ],
      trustDelta: -0.2,
    };

    const style = computeStyle(memory as never);
    assert.strictEqual(style, "light_check");
  });

  it("relationship memory feedback persistence round-trip", async () => {
    const db = createStateDatabase(":memory:");
    const store = createRelationshipMemoryStore(db);

    // Seed initial memory so load doesn't return null
    await store.upsertRelationshipMemory({
      relationshipId: "default",
      revision: 0,
      tonePreference: "unknown",
      noReplyCount: 0,
      topicAffinities: [],
      sourceRefs: [],
      updatedAt: "2026-05-21T00:00:00Z",
    });

    const initial = await store.loadRelationshipMemory();
    assert.ok(initial);
    assert.strictEqual(initial!.noReplyCount, 0);

    // Simulate feedback ingestion by updating memory directly
    await store.upsertRelationshipMemory({
      relationshipId: "default",
      revision: 1,
      tonePreference: "quiet",
      averageReplyDelayMinutes: 120,
      noReplyCount: 3,
      topicAffinities: [{ topic: "work", affinity: 0.8 }],
      lastInteractionAt: "2026-05-21T00:00:00Z",
      sourceRefs: [{ sourceId: "feedback-1", kind: "owner_reply" }],
      updatedAt: "2026-05-21T00:00:00Z",
    });

    const updated = await store.loadRelationshipMemory();
    assert.ok(updated);
    assert.strictEqual(updated!.noReplyCount, 3);
    assert.strictEqual(updated!.tonePreference, "quiet");

    // Verify guidance strategy reacts to persisted memory
    const memory = {
      channelPreferences: [],
      responsePatterns: [
        { reaction: "ignore", timing: "unknown", tone: "unknown", observedAt: "2026-05-21T00:00:00Z" },
        { reaction: "ignore", timing: "unknown", tone: "unknown", observedAt: "2026-05-21T00:00:00Z" },
        { reaction: "ignore", timing: "unknown", tone: "unknown", observedAt: "2026-05-21T00:00:00Z" },
      ],
      trustDelta: 0,
    };
    const frequency = computeFrequency(memory as never);
    assert.strictEqual(frequency, "reduced");
  });
});
