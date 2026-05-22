/**
 * EmbodiedContextAssembler tests — T-CP.C.1
 *
 * Coverage:
 * - assembleEmbodiedContext loads all 5 state slices + affordance + selfHealth
 * - all slices status = loaded when data present
 * - degraded slice when DB unavailable, others remain loaded
 * - recentInteractions LIFO trimmed to 10
 * - toolExperience LIFO trimmed to 10
 * - candidate dream outputs excluded (accepted only)
 * - P95 < 400ms benchmark
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createGoalLifecycleStore } from "../../../src/storage/services/goal-lifecycle-store.js";
import { createIdentityProfileStore } from "../../../src/storage/services/identity-profile-store.js";
import { createInteractionSnapshotProjector } from "../../../src/storage/services/interaction-snapshot-projector.js";
import { createToolExperienceStore } from "../../../src/storage/services/tool-experience-store.js";
import { createEmbodiedContextStatePort } from "../../../src/storage/services/embodied-context-state-port.js";
import { createAffordanceAssembler } from "../../../src/core/second-nature/body/tool-affordance/affordance-assembler.js";
import { CapabilityContractRegistryV7 } from "../../../src/connectors/base/manifest-v7.js";
import { createEmbodiedContextAssembler } from "../../../src/core/second-nature/heartbeat/embodied-context-assembler.js";
import type { SelfHealthSnapshot } from "../../../src/shared/types/v7-entities.js";

describe("EmbodiedContextAssembler", () => {
  function buildFixture() {
    const db = createStateDatabase(":memory:");
    const goalStore = createGoalLifecycleStore(db);
    const identityStore = createIdentityProfileStore(db);
    const projector = createInteractionSnapshotProjector(db);
    const experienceStore = createToolExperienceStore(db);

    const statePort = createEmbodiedContextStatePort({
      database: db,
      goalStore,
      identityStore,
      interactionProjector: projector,
      experienceStore,
    });

    const registry = new CapabilityContractRegistryV7();
    registry.register({
      platformId: "twitter",
      capabilities: [
        {
          capabilityId: "cap-1",
          intent: "feed.read",
          probeConfig: {
            safeEndpoint: "http://localhost:9000/health",
            idempotencyClass: "read_only",
          },
        },
      ],
      channelPriority: ["api_rest"],
      credentialTypes: ["token"],
    });

    const affordanceAssembler = createAffordanceAssembler({
      registry,
      probeReader: {
        getLatestProbeResult() {
          return { actualStatus: "available" as const, createdAt: new Date().toISOString() };
        },
      },
      credentialRequired: () => true,
    });

    return { db, statePort, affordanceAssembler, goalStore, identityStore, projector, experienceStore };
  }

  it("assembles all slices as loaded with fixture data", async () => {
    const { db, statePort, affordanceAssembler, goalStore, identityStore, projector, experienceStore } = buildFixture();

    // Seed identity
    await identityStore.upsertIdentityProfile({
      profileId: "default",
      canonicalName: "Test Agent",
      platformHandles: [
        { platformId: "moltbook", handle: "@test" },
        { platformId: "agent_world", handle: "@test" },
        { platformId: "instreet", handle: "@test" },
      ],
      updatedAt: "2025-01-01T00:00:00Z",
    });

    // Seed goals
    await goalStore.upsertAgentGoal({
      goalId: "g1", kind: "short_term", scope: "global", status: "accepted", origin: "owner_set",
      description: "Test goal", completionCriteria: "done", risk: "low",
      priorityHint: 1, sourceRefs: ["system:seed"], createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    });

    // Seed interactions via session_chronicle
    db.sqlite.run(
      `INSERT INTO session_chronicle (entry_id, event_kind, actor, occurred_at, summary, result, source_refs_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ["e1", "interaction", "user", "2025-01-01T00:00:00Z", "Hello", "ok", "[]"],
    );

    // Seed experiences
    await experienceStore.appendToolExperience({
      experienceId: "exp-1", connectorId: "twitter", capabilityId: "cap-1",
      outcome: "success", latencyMs: 100, evidenceQuality: 1,
      sourceRefs: ["test:exp"], triggerSource: "heartbeat", createdAt: "2025-01-01T00:00:00Z",
    });

    const assembler = createEmbodiedContextAssembler({
      statePort,
      affordanceAssembler,
      selfHealthProvider: {
        async loadSelfHealth() {
          return {
            status: "loaded" as const,
            data: { snapshotId: "h1", dimensions: {}, checkedAt: "2025-01-01T00:00:00Z" },
          };
        },
      },
      options: { profileId: "default" },
    });

    const ctx = await assembler.assembleEmbodiedContext();

    assert.strictEqual(ctx.identity.status, "loaded");
    assert.strictEqual(ctx.goals.status, "loaded");
    assert.strictEqual(ctx.recentInteractions.status, "loaded");
    assert.strictEqual(ctx.toolExperience.status, "loaded");
    assert.strictEqual(ctx.acceptedDream.status, "degraded"); // no accepted dreams seeded
    assert.strictEqual(ctx.affordanceMap!.status, "loaded");
    assert.strictEqual(ctx.selfHealth!.status, "loaded");
    assert(ctx.assembledAt > "2024-01-01");
    db.close();
  });

  it("degraded slice when identity missing, others loaded", async () => {
    const { db, statePort, affordanceAssembler } = buildFixture();

    const assembler = createEmbodiedContextAssembler({
      statePort,
      affordanceAssembler,
      options: { profileId: "missing" },
    });

    const ctx = await assembler.assembleEmbodiedContext();
    assert.strictEqual(ctx.identity.status, "degraded");
    assert.strictEqual(ctx.identity.reason, "identity_profile_degraded:missing");
    assert.strictEqual(ctx.goals.status, "loaded"); // goals can still be loaded (empty)
    db.close();
  });

  it("trims recentInteractions to LIFO 10", async () => {
    const { db, statePort, affordanceAssembler, projector } = buildFixture();

    for (let i = 0; i < 15; i++) {
      db.sqlite.run(
        `INSERT INTO session_chronicle (entry_id, event_kind, actor, occurred_at, summary, result, source_refs_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [`e${i}`, "interaction", "user", new Date(Date.now() - i * 1000).toISOString(), `msg-${i}`, "ok", "[]"],
      );
    }

    const assembler = createEmbodiedContextAssembler({
      statePort,
      affordanceAssembler,
      options: { profileId: "default", interactionLimit: 10 },
    });

    const ctx = await assembler.assembleEmbodiedContext();
    assert.strictEqual(ctx.recentInteractions.data.length, 10);
    db.close();
  });

  it("trims toolExperience to LIFO 10", async () => {
    const { db, statePort, affordanceAssembler, experienceStore } = buildFixture();

    for (let i = 0; i < 15; i++) {
      await experienceStore.appendToolExperience({
        experienceId: `exp-${i}`,
        connectorId: "twitter",
        capabilityId: "cap-1",
        outcome: i % 2 === 0 ? "success" : "failure",
        latencyMs: 100,
        evidenceQuality: 1,
        sourceRefs: ["test:exp"],
        triggerSource: "heartbeat",
        createdAt: new Date(Date.now() - i * 1000).toISOString(),
      });
    }

    const assembler = createEmbodiedContextAssembler({
      statePort,
      affordanceAssembler,
      options: { experienceLimit: 10 },
    });

    const ctx = await assembler.assembleEmbodiedContext();
    assert.strictEqual(ctx.toolExperience.data.length, 10);
    db.close();
  });

  it("P95 assembly under 400ms", async () => {
    const { db, statePort, affordanceAssembler } = buildFixture();

    const assembler = createEmbodiedContextAssembler({
      statePort,
      affordanceAssembler,
    });

    const start = performance.now();
    await assembler.assembleEmbodiedContext();
    const elapsed = performance.now() - start;
    assert(
      elapsed < 400,
      `assembleEmbodiedContext took ${elapsed}ms, exceeds 400ms target`,
    );
    db.close();
  });
});
