/**
 * T-SMS.C.2 — EmbodiedContextStatePort 单元测试
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createGoalLifecycleStore } from "../../../src/storage/services/goal-lifecycle-store.js";
import { createIdentityProfileStore } from "../../../src/storage/services/identity-profile-store.js";
import { createInteractionSnapshotProjector } from "../../../src/storage/services/interaction-snapshot-projector.js";
import { createToolExperienceStore } from "../../../src/storage/services/tool-experience-store.js";
import { createEmbodiedContextStatePort } from "../../../src/storage/services/embodied-context-state-port.js";
import type { AgentGoalWrite } from "../../../src/shared/types/goal.js";

describe("EmbodiedContextStatePort", () => {
  it("loads identity profile with loaded status", async () => {
    const db = createStateDatabase(":memory:");
    const identityStore = createIdentityProfileStore(db);
    const port = createEmbodiedContextStatePort({
      database: db,
      goalStore: createGoalLifecycleStore(db),
      identityStore,
      interactionProjector: createInteractionSnapshotProjector(db),
      experienceStore: createToolExperienceStore(db),
    });

    await identityStore.upsertIdentityProfile({
      profileId: "prof-1",
      canonicalName: "Nyx",
      platformHandles: [
        { platformId: "moltbook", handle: "nyx_ha" },
        { platformId: "agent_world", handle: "haai-arch" },
        { platformId: "instreet", handle: "haai_17949e" },
      ],
      updatedAt: "2026-05-21T00:00:00Z",
    });

    const result = await port.loadIdentityProfile("prof-1");
    assert.strictEqual(result.status, "loaded");
    if (result.status === "loaded") {
      assert.strictEqual(result.data.canonicalName, "Nyx");
    }
  });

  it("lists active goals", async () => {
    const db = createStateDatabase(":memory:");
    const goalStore = createGoalLifecycleStore(db);
    const port = createEmbodiedContextStatePort({
      database: db,
      goalStore,
      identityStore: createIdentityProfileStore(db),
      interactionProjector: createInteractionSnapshotProjector(db),
      experienceStore: createToolExperienceStore(db),
    });

    const goal: AgentGoalWrite = {
      goalId: "g-1", kind: "short_term", scope: "global", status: "accepted",
      origin: "owner_set", description: "Test", completionCriteria: "Done",
      risk: "low", priorityHint: 1, sourceRefs: ["ref:1"],
      createdAt: "2026-05-21T00:00:00Z", updatedAt: "2026-05-21T00:00:00Z",
    };
    await goalStore.upsertAgentGoal(goal);

    const result = await port.listActiveGoals(10);
    assert.strictEqual(result.status, "loaded");
    if (result.status === "loaded") {
      assert.strictEqual(result.data.length, 1);
    }
  });

  it("returns degraded reason when no accepted dream exists", async () => {
    const db = createStateDatabase(":memory:");
    const port = createEmbodiedContextStatePort({
      database: db,
      goalStore: createGoalLifecycleStore(db),
      identityStore: createIdentityProfileStore(db),
      interactionProjector: createInteractionSnapshotProjector(db),
      experienceStore: createToolExperienceStore(db),
    });

    const result = await port.loadAcceptedDreamProjection(3);
    assert.strictEqual(result.status, "degraded");
    if (result.status === "degraded") {
      assert.strictEqual(result.reason, "context_degraded:dream_projection_unavailable");
    }
  });
});
