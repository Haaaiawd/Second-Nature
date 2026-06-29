/**
 * Context continuity injection integration test — T2.2.1
 *
 * Coverage:
 * - createV9EmbodiedContextAssemblerFromDeps wires real v9 read ports.
 * - Assembled EmbodiedContext can be serialized with contestable markers.
 * - ActivityThreadPort reads active + paused threads from real DB.
 * - CharacterLoaderPort builds pointer + projection from accepted CharacterFrame.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createGoalLifecycleStore } from "../../../src/storage/services/goal-lifecycle-store.js";
import { createIdentityProfileStore } from "../../../src/storage/services/identity-profile-store.js";
import { createInteractionSnapshotProjector } from "../../../src/storage/services/interaction-snapshot-projector.js";
import { createToolExperienceStore } from "../../../src/storage/services/tool-experience-store.js";
import { createDiaryDreamStore } from "../../../src/storage/services/diary-dream-store.js";
import { createEmbodiedContextStatePort } from "../../../src/storage/services/embodied-context-state-port.js";
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
import type { SourceRef as V8SourceRef } from "../../../src/shared/types/v8-contracts.js";
import type { SourceRefFamily as V9SourceRefFamily } from "../../../src/shared/types/v9-contracts.js";

describe("Context continuity injection", () => {
  it("assembles and serializes v9 EmbodiedContext end-to-end", async () => {
    const db = createStateDatabase(":memory:");

    const identityStore = createIdentityProfileStore(db);
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

    const goalStore = createGoalLifecycleStore(db);
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

    const diaryDreamStore = createDiaryDreamStore(db);
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
      sourceRefs: [{ family: "routine" as V9SourceRefFamily, id: "r1" }],
    });

    await writeToolRoutine(db, {
      id: "routine-1",
      name: "Twitter feed routine",
      version: "1.0.0",
      capabilityPattern: "twitter:feed.read",
      rollbackRef: "rollback-1",
      status: "active",
      sourceRefs: [{ family: "routine" as V9SourceRefFamily, id: "r1" }],
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
        valuePosture: { ordering: ["clarity", "kindness"], sourceRefs: [{ family: "character" as const, id: "s2" }] },
        relationshipPosture: { toward: "owner", stance: "collaborative", sourceRefs: [{ family: "character" as const, id: "s3" }] },
        expressionPosture: { styleNotes: ["concise"], sourceRefs: [{ family: "character" as const, id: "s4" }] },
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

    const continuityReadPort = createContinuityReadPort(db);

    const assembler = createV9EmbodiedContextAssemblerFromDeps({
      db,
      statePort,
      affordanceAssembler,
      continuityReadPort,
    });

    const context = await assembler.assembleEmbodiedContext();

    assert.strictEqual(context.identity.status, "loaded");
    assert.strictEqual(context.selfContinuityCard.status, "loaded");
    assert.strictEqual(context.characterFramePointer.status, "loaded");
    assert.strictEqual(context.characterFrameProjection.status, "loaded");
    assert.strictEqual(context.activeMemoryProjections.status, "loaded");
    assert.strictEqual(context.activeProceduralProjections.status, "loaded");
    assert.strictEqual(context.routineList.status, "loaded");
    assert.strictEqual(context.activityThreads.status, "loaded");
    assert.strictEqual(context.activityThreads.data.length, 1);

    const serialized = serializeEmbodiedContext(context);
    assert.ok(serialized.text.includes("## selfContinuityCard"));
    assert.ok(serialized.text.includes("## characterFrameProjection"));
    assert.ok(serialized.text.includes("[Contestable projection]"));
    assert.ok(serialized.text.includes("## activityThreads"));
    assert.strictEqual(serialized.forbiddenPatternWarnings.length, 0);

    db.close();
  });
});
