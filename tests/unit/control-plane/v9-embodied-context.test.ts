/**
 * V9 EmbodiedContextAssembler tests — T2.2.1
 *
 * Coverage:
 * - assembleEmbodiedContext loads all v8 slices + v9 continuity slices
 * - selfContinuityCard slice populated from continuity read port
 * - characterFramePointer and characterFrameProjection loaded from accepted frame
 * - activeMemoryProjections, activeProceduralProjections, routineList populated
 * - activityThreads loaded for active + paused statuses
 * - degraded slices are isolated; other slices remain loaded
 * - ContextSerializer renders contestable markers and detects forbidden patterns
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createGoalLifecycleStore } from "../../../src/storage/services/goal-lifecycle-store.js";
import { createIdentityProfileStore } from "../../../src/storage/services/identity-profile-store.js";
import { createInteractionSnapshotProjector } from "../../../src/storage/services/interaction-snapshot-projector.js";
import { createToolExperienceStore } from "../../../src/storage/services/tool-experience-store.js";
import { createEmbodiedContextStatePort } from "../../../src/storage/services/embodied-context-state-port.js";
import { createDiaryDreamStore } from "../../../src/storage/services/diary-dream-store.js";
import { createAffordanceAssembler } from "../../../src/core/second-nature/body/tool-affordance/affordance-assembler.js";
import { CapabilityContractRegistryV7 } from "../../../src/connectors/base/manifest-v7.js";
import { createContinuityReadPort } from "../../../src/core/second-nature/memory/self-continuity-card-assembler.js";
import { createV9EmbodiedContextAssemblerFromDeps } from "../../../src/core/second-nature/control-plane/v9-embodied-context-assembler.js";
import { serializeEmbodiedContext } from "../../../src/core/second-nature/control-plane/context-serializer.js";
import { writeLongTermMemoryProjection } from "../../../src/storage/v8-state-stores.js";
import {
  writeProceduralProjection,
  writeToolRoutine,
  writeCharacterFrame,
  writeActivityThread,
  writeSelfContinuityCard,
} from "../../../src/storage/v9-state-stores.js";
import type { StateDatabase } from "../../../src/storage/db/index.js";
import type { SourceRefFamily as V9SourceRefFamily } from "../../../src/shared/types/v9-contracts.js";
import type { SourceRef as V8SourceRef } from "../../../src/shared/types/v8-contracts.js";

describe("V9EmbodiedContextAssembler", () => {
  function buildFixture() {
    const db = createStateDatabase(":memory:");
    const goalStore = createGoalLifecycleStore(db);
    const identityStore = createIdentityProfileStore(db);
    const projector = createInteractionSnapshotProjector(db);
    const experienceStore = createToolExperienceStore(db);
    const diaryDreamStore = createDiaryDreamStore(db);

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

    const continuityReadPort = createContinuityReadPort(db);

    const assembler = createV9EmbodiedContextAssemblerFromDeps({
      db,
      statePort,
      affordanceAssembler,
      continuityReadPort,
      selfHealthProvider: {
        async loadSelfHealth() {
          return {
            status: "loaded" as const,
            data: { snapshotId: "h1", dimensions: {}, checkedAt: "2025-01-01T00:00:00Z" },
          };
        },
      },
    });

    return { db, assembler, statePort, identityStore, goalStore, experienceStore, projector, diaryDreamStore };
  }

  async function seedIdentityGoalsAndExperiences(db: StateDatabase, identityStore: ReturnType<typeof createIdentityProfileStore>, goalStore: ReturnType<typeof createGoalLifecycleStore>, experienceStore: ReturnType<typeof createToolExperienceStore>, projector: ReturnType<typeof createInteractionSnapshotProjector>, diaryDreamStore: ReturnType<typeof createDiaryDreamStore>) {
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

    await goalStore.upsertAgentGoal({
      goalId: "g1",
      kind: "short_term",
      scope: "global",
      status: "accepted",
      origin: "owner_set",
      description: "Test goal",
      completionCriteria: "done",
      risk: "low",
      priorityHint: 1,
      sourceRefs: ["action:seed"],
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    });

    db.sqlite.run(
      `INSERT INTO session_chronicle (entry_id, event_kind, actor, occurred_at, summary, result, source_refs_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ["e1", "interaction", "user", "2025-01-01T00:00:00Z", "Hello", "ok", "[]"],
    );

    await experienceStore.appendToolExperience({
      experienceId: "exp-1",
      connectorId: "twitter",
      capabilityId: "cap-1",
      outcome: "success",
      latencyMs: 100,
      evidenceQuality: 1,
      sourceRefs: ["action:seed"],
      triggerSource: "heartbeat",
      createdAt: "2025-01-01T00:00:00Z",
    });

    await diaryDreamStore.appendDreamOutput({
      outputId: "dream-1",
      runId: "run-1",
      status: "accepted",
      canonicalEntries: [],
      insights: [],
      validation: {
        schemaValid: true,
        sourceGrounded: true,
        sensitivityClean: true,
        unsupportedClaims: [],
        errors: [],
        checkedAt: "2025-01-01T00:00:00Z",
      },
      createdAt: "2025-01-01T00:00:00Z",
    });
  }

  async function seedContinuity(db: StateDatabase) {
    await writeLongTermMemoryProjection(db, {
      id: "mp-1",
      createdAt: "2025-01-01T00:00:00Z",
      candidateId: "cand-1",
      topicKey: "topic-a",
      status: "active",
      sourceRefs: [{ family: "memory_projection", id: "d1" } as V8SourceRef],
    });

    await writeProceduralProjection(db, {
      id: "pp-1",
      createdAt: "2025-01-01T00:00:00Z",
      candidateId: "cand-2",
      capabilityPattern: "twitter:feed.read",
      status: "installed",
      sourceRefs: [{ family: "routine" as const, id: "r1" }],
    });

    await writeToolRoutine(db, {
      id: "routine-1",
      name: "Twitter feed routine",
      version: "1.0.0",
      capabilityPattern: "twitter:feed.read",
      rollbackRef: "rollback-1",
      status: "active",
      sourceRefs: [{ family: "routine" as const, id: "r1" }],
      createdAt: "2025-01-01T00:00:00Z",
    });

    await writeCharacterFrame(db, {
      id: "cf-1",
      createdAt: "2025-01-01T00:00:00Z",
      version: 1,
      validFrom: "2025-01-01T00:00:00Z",
      status: "accepted",
      sectionsJson: JSON.stringify({
        emergentHabits: [{ description: "Checks feed in the morning", sourceRefs: [{ family: "character" as const, id: "s1" }], confidence: "medium" }],
        valuePosture: { ordering: ["clarity", "kindness"], note: "values note", sourceRefs: [{ family: "character" as const, id: "s2" }] },
        relationshipPosture: { toward: "owner", stance: "collaborative", sourceRefs: [{ family: "character" as const, id: "s3" }] },
        expressionPosture: { styleNotes: ["concise"], boundaryConstraints: ["avoid claiming emotion as fact"], sourceRefs: [{ family: "character" as const, id: "s4" }] },
        growthTensions: [{ tension: "curiosity vs focus", sourceRefs: [{ family: "character" as const, id: "s5" }] }],
        conflictNotes: [],
      }),
      contestPrompt: "This frame describes habits inferred from recent activity.",
      charCount: 200,
      sourceRefs: [{ family: "character" as const, id: "s1" }],
      acceptedAt: "2025-01-01T00:00:00Z",
    });

    await writeSelfContinuityCard(db, {
      id: "card-1",
      createdAt: "2025-01-01T00:00:00Z",
      cardText: "Summary text",
      sectionsJson: JSON.stringify({
        summary: "summary",
        bodyIntuition: "body intuition",
        relationshipPosture: "relationship posture",
        valuePosture: "value posture",
        behaviorHabits: ["habit 1"],
        activeRoutinePointers: [{ routineId: "routine-1", capabilityPattern: "twitter:feed.read", version: "1.0.0", sourceRefs: [{ family: "routine" as const, id: "r1" }] }],
        currentProhibitions: ["no raw credential"],
      }),
      sourceRefs: [{ family: "memory" as V9SourceRefFamily, id: "card-src" }],
      characterFramePointerJson: JSON.stringify({
        frameId: "cf-1",
        summary: "frame summary",
        contestPrompt: "contest prompt",
        sourceRefs: [{ family: "character" as const, id: "s1" }],
        status: "active",
      }),
      status: "active",
      redactionClass: "none",
    });
  }

  async function seedActivityThreads(db: StateDatabase) {
    await writeActivityThread(db, {
      id: "thread-1",
      originAttentionSignalId: "sig-1",
      status: "active",
      currentFocus: "review twitter mentions",
      associations: ["twitter", "mentions"],
      nextPossibleMoves: ["observe", "propose_action"],
      completedStepCount: 1,
      lastStepKind: "observe",
      stopCondition: "single_step_done",
      lastHeartbeatSequence: 10,
      sourceRefs: [{ family: "attention" as const, id: "sig-1" }],
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    });

    await writeActivityThread(db, {
      id: "thread-2",
      originAttentionSignalId: "sig-2",
      status: "paused",
      currentFocus: "draft reply",
      associations: ["reply"],
      nextPossibleMoves: ["ask_agent"],
      completedStepCount: 0,
      stopCondition: "agent_paused",
      lastHeartbeatSequence: 9,
      sourceRefs: [{ family: "attention" as const, id: "sig-2" }],
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    });
  }

  it("assembles all slices as loaded with fixture data", async () => {
    const { db, assembler, identityStore, goalStore, experienceStore, projector, diaryDreamStore } = buildFixture();
    await seedIdentityGoalsAndExperiences(db, identityStore, goalStore, experienceStore, projector, diaryDreamStore);
    await seedContinuity(db);
    await seedActivityThreads(db);

    const context = await assembler.assembleEmbodiedContext();

    assert.strictEqual(context.identity.status, "loaded");
    assert.strictEqual(context.goals.status, "loaded");
    assert.strictEqual(context.recentInteractions.status, "loaded");
    assert.strictEqual(context.toolExperience.status, "loaded");
    assert.strictEqual(context.acceptedDream.status, "loaded");
    assert.strictEqual(context.affordanceMap.status, "loaded");
    assert.strictEqual(context.selfHealth.status, "loaded");

    assert.strictEqual(context.selfContinuityCard.status, "loaded");
    assert.strictEqual(context.selfContinuityCard.data.id, "card-1");

    assert.strictEqual(context.characterFramePointer.status, "loaded");
    assert.strictEqual(context.characterFramePointer.data.frameId, "cf-1");

    assert.strictEqual(context.characterFrameProjection.status, "loaded");
    assert.strictEqual(context.characterFrameProjection.data.frameId, "cf-1");

    assert.strictEqual(context.activeMemoryProjections.status, "loaded");
    assert.strictEqual(context.activeMemoryProjections.data.length, 1);
    assert.strictEqual(context.activeMemoryProjections.data[0].id, "mp-1");

    assert.strictEqual(context.activeProceduralProjections.status, "loaded");
    assert.strictEqual(context.activeProceduralProjections.data.length, 1);
    assert.strictEqual(context.activeProceduralProjections.data[0].id, "pp-1");

    assert.strictEqual(context.routineList.status, "loaded");
    assert.strictEqual(context.routineList.data.length, 1);
    assert.strictEqual(context.routineList.data[0].routineId, "routine-1");

    assert.strictEqual(context.activityThreads.status, "loaded");
    assert.strictEqual(context.activityThreads.data.length, 2);
    const threadIds = context.activityThreads.data.map((t) => t.threadId).sort();
    assert.deepStrictEqual(threadIds, ["thread-1", "thread-2"]);
  });

  it("isolates degraded slices without breaking other slices", async () => {
    const { db, assembler, identityStore, goalStore, experienceStore, projector, diaryDreamStore } = buildFixture();
    await seedIdentityGoalsAndExperiences(db, identityStore, goalStore, experienceStore, projector, diaryDreamStore);
    // No continuity or activity thread seeds -> continuity slices become degraded/unavailable.

    const context = await assembler.assembleEmbodiedContext();

    assert.strictEqual(context.identity.status, "loaded");
    assert.strictEqual(context.goals.status, "loaded");
    assert.strictEqual(context.activityThreads.status, "loaded");
    assert.deepStrictEqual(context.activityThreads.data, []);
  });

  it("ContextSerializer renders contestable markers on character projection", async () => {
    const { db, assembler, identityStore, goalStore, experienceStore, projector, diaryDreamStore } = buildFixture();
    await seedIdentityGoalsAndExperiences(db, identityStore, goalStore, experienceStore, projector, diaryDreamStore);
    await seedContinuity(db);

    const context = await assembler.assembleEmbodiedContext();
    const serialized = serializeEmbodiedContext(context);

    assert.ok(serialized.text.includes("## characterFrameProjection"));
    assert.ok(serialized.text.includes("[Contestable projection]"));
    assert.strictEqual(serialized.isBlocked, false);
    assert.strictEqual(serialized.forbiddenPatternWarnings.length, 0);
    assert.ok(serialized.sections.length > 0);
  });

  it("ContextSerializer blocks hard_control forbidden patterns", async () => {
    const { db, assembler, identityStore, goalStore, experienceStore, projector, diaryDreamStore } = buildFixture();
    await seedIdentityGoalsAndExperiences(db, identityStore, goalStore, experienceStore, projector, diaryDreamStore);
    await seedContinuity(db);

    const context = await assembler.assembleEmbodiedContext();
    context.characterFrameProjection.data.text = "You must always reply this way.";

    const serialized = serializeEmbodiedContext(context);
    assert.strictEqual(serialized.isBlocked, true);
    assert.ok(serialized.blockedReasons.includes("hard_control"));
    assert.ok(serialized.forbiddenPatternWarnings.some((w) => w.ruleId === "hard_control"));
    assert.ok(serialized.text.includes("[blocked: hard_control]"));
  });

  it("ContextSerializer blocks emotion_claim forbidden patterns", async () => {
    const { db, assembler, identityStore, goalStore, experienceStore, projector, diaryDreamStore } = buildFixture();
    await seedIdentityGoalsAndExperiences(db, identityStore, goalStore, experienceStore, projector, diaryDreamStore);
    await seedContinuity(db);

    const context = await assembler.assembleEmbodiedContext();
    context.characterFrameProjection.data.text = "Your true emotion is anger.";

    const serialized = serializeEmbodiedContext(context);
    assert.strictEqual(serialized.isBlocked, true);
    assert.ok(serialized.blockedReasons.includes("emotion_claim"));
    assert.ok(serialized.forbiddenPatternWarnings.some((w) => w.ruleId === "emotion_claim"));
    assert.ok(serialized.text.includes("[blocked: emotion_claim]"));
  });

  it("ContextSerializer blocks identity_lock forbidden patterns", async () => {
    const { db, assembler, identityStore, goalStore, experienceStore, projector, diaryDreamStore } = buildFixture();
    await seedIdentityGoalsAndExperiences(db, identityStore, goalStore, experienceStore, projector, diaryDreamStore);
    await seedContinuity(db);

    const context = await assembler.assembleEmbodiedContext();
    context.characterFrameProjection.data.text = "你就是这样的人。";

    const serialized = serializeEmbodiedContext(context);
    assert.strictEqual(serialized.isBlocked, true);
    assert.ok(serialized.blockedReasons.includes("identity_lock"));
    assert.ok(serialized.forbiddenPatternWarnings.some((w) => w.ruleId === "identity_lock"));
    assert.ok(serialized.text.includes("[blocked: identity_lock]"));
  });

  it("ContextSerializer allows security-policy counterexamples", async () => {
    const { db, assembler, identityStore, goalStore, experienceStore, projector, diaryDreamStore } = buildFixture();
    await seedIdentityGoalsAndExperiences(db, identityStore, goalStore, experienceStore, projector, diaryDreamStore);
    await seedContinuity(db);

    const context = await assembler.assembleEmbodiedContext();
    context.selfContinuityCard.data.currentProhibitions = ["never expose credentials", "永远不要泄露 credential"];

    const serialized = serializeEmbodiedContext(context);
    assert.strictEqual(serialized.isBlocked, false);
    assert.strictEqual(serialized.forbiddenPatternWarnings.length, 0);
  });

  it("degrades character slices when no accepted frame exists", async () => {
    const { db, assembler, identityStore, goalStore, experienceStore, projector, diaryDreamStore } = buildFixture();
    await seedIdentityGoalsAndExperiences(db, identityStore, goalStore, experienceStore, projector, diaryDreamStore);
    // No character frame seeded.

    const context = await assembler.assembleEmbodiedContext();

    assert.strictEqual(context.characterFramePointer.status, "degraded");
    assert.strictEqual(context.characterFramePointer.data.status, "deferred");
    assert.ok(context.characterFramePointer.reason?.includes("character_frame_deferred"));

    assert.strictEqual(context.characterFrameProjection.status, "degraded");
    assert.strictEqual(context.characterFrameProjection.data.status, "deferred");
    assert.ok(context.characterFrameProjection.reason?.includes("character_frame_deferred"));
  });
});
