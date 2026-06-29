/**
 * Context deadline integration test — T2.2.3
 *
 * Validates with real DB + slow read port fixture:
 * - One non-critical read port hangs → that slice degrades, others remain loaded
 * - Assembly completes before configured hard deadline
 * - Latency stage event is emitted with correct data
 * - p95 budget is within 2s heartbeat deadline
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
import { createV9EmbodiedContextAssembler } from "../../../src/core/second-nature/control-plane/v9-embodied-context-assembler.js";
import {
  writeSelfContinuityCard,
  writeCharacterFrame,
  writeActivityThread,
} from "../../../src/storage/v9-state-stores.js";
import type { ContextAssemblyLatencyReport } from "../../../src/shared/types/v9-contracts.js";

describe("Context deadline integration", () => {
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
    });

    const continuityReadPort = createContinuityReadPort(db);

    return { db, statePort, affordanceAssembler, continuityReadPort };
  }

  it("slow continuity read port degrades selfContinuityCard, other slices remain loaded", async () => {
    const fixture = buildFixture();

    // Seed identity
    const identityStore = createIdentityProfileStore(fixture.db);
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

    // Seed continuity card
    await writeSelfContinuityCard(fixture.db, {
      id: "card-1",
      createdAt: "2025-01-01T00:00:00Z",
      cardText: "Summary text",
      sectionsJson: JSON.stringify({
        summary: "summary",
        bodyIntuition: "body intuition",
        relationshipPosture: "relationship posture",
        valuePosture: "value posture",
        behaviorHabits: [],
        activeRoutinePointers: [],
        currentProhibitions: [],
      }),
      sourceRefs: [{ family: "evidence" as const, id: "card-src" }],
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

    // Wrap continuityReadPort to add delay to loadSelfContinuityCard
    const slowContinuityReadPort = {
      ...fixture.continuityReadPort,
      async loadSelfContinuityCard(scope: any) {
        await new Promise<void>((r) => setTimeout(r, 2000));
        return fixture.continuityReadPort.loadSelfContinuityCard(scope);
      },
    };

    const reports: ContextAssemblyLatencyReport[] = [];
    const assembler = createV9EmbodiedContextAssembler({
      statePort: fixture.statePort,
      affordanceAssembler: fixture.affordanceAssembler,
      continuityReadPort: slowContinuityReadPort as any,
      characterLoader: {
        async loadActiveCharacterFrame() {
          return { degraded: { reason: "no_frame", code: "no_frame" } };
        },
      },
      activityThreadPort: {
        async loadActivityThreads() {
          return { status: "loaded" as const, data: [] };
        },
      } as any,
      stageEventSink: {
        recordContextAssemblyLatency(report: ContextAssemblyLatencyReport) {
          reports.push(report);
        },
      },
      options: {
        hardDeadlineMs: 2000,
        criticalSliceTimeoutMs: 1500,
        nonCriticalSliceTimeoutMs: 100,
      },
    });

    const start = Date.now();
    const ctx = await assembler.assembleEmbodiedContext();
    const elapsed = Date.now() - start;

    // Should complete well within 2s because slow slice times out at 100ms
    assert.ok(elapsed < 1000, `assembly should complete within deadline, took ${elapsed}ms`);

    // selfContinuityCard should be degraded due to timeout
    assert.equal(ctx.selfContinuityCard.status, "degraded");
    assert.equal(ctx.selfContinuityCard.reason, "slice_timeout");

    // identity should be loaded (from real DB)
    assert.equal(ctx.identity.status, "loaded");

    // Latency report should be emitted
    assert.equal(reports.length, 1);
    const report = reports[0];
    assert.ok(report.degradedSlices.includes("selfContinuityCard"));
    assert.ok(report.timedOutSlices.includes("selfContinuityCard"));
    assert.equal(report.withinDeadline, true);
  });

  it("assembly with all fast ports completes well within 2s deadline", async () => {
    const fixture = buildFixture();

    // Seed identity
    const identityStore = createIdentityProfileStore(fixture.db);
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

    const reports: ContextAssemblyLatencyReport[] = [];
    const assembler = createV9EmbodiedContextAssembler({
      statePort: fixture.statePort,
      affordanceAssembler: fixture.affordanceAssembler,
      continuityReadPort: fixture.continuityReadPort,
      characterLoader: {
        async loadActiveCharacterFrame() {
          return { degraded: { reason: "no_frame", code: "no_frame" } };
        },
      },
      activityThreadPort: {
        async loadActivityThreads() {
          return { status: "loaded" as const, data: [] };
        },
      } as any,
      stageEventSink: {
        recordContextAssemblyLatency(report: ContextAssemblyLatencyReport) {
          reports.push(report);
        },
      },
      options: {
        hardDeadlineMs: 2000,
        criticalSliceTimeoutMs: 1500,
        nonCriticalSliceTimeoutMs: 600,
      },
    });

    const start = Date.now();
    const ctx = await assembler.assembleEmbodiedContext();
    const elapsed = Date.now() - start;

    // Should complete very quickly with in-memory DB
    assert.ok(elapsed < 500, `assembly should be fast with in-memory DB, took ${elapsed}ms`);

    // All real-DB slices should be loaded
    assert.equal(ctx.identity.status, "loaded");
    assert.equal(ctx.goals.status, "loaded");

    // Latency report
    assert.equal(reports.length, 1);
    assert.equal(reports[0].withinDeadline, true);
    assert.equal(reports[0].hardDeadlineMs, 2000);
  });

  it("p95 budget: 10 consecutive assemblies all complete within 2s deadline", async () => {
    const fixture = buildFixture();

    // Seed identity
    const identityStore = createIdentityProfileStore(fixture.db);
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

    const assembler = createV9EmbodiedContextAssembler({
      statePort: fixture.statePort,
      affordanceAssembler: fixture.affordanceAssembler,
      continuityReadPort: fixture.continuityReadPort,
      characterLoader: {
        async loadActiveCharacterFrame() {
          return { degraded: { reason: "no_frame", code: "no_frame" } };
        },
      },
      activityThreadPort: {
        async loadActivityThreads() {
          return { status: "loaded" as const, data: [] };
        },
      } as any,
      options: {
        hardDeadlineMs: 2000,
        criticalSliceTimeoutMs: 1500,
        nonCriticalSliceTimeoutMs: 600,
      },
    });

    const durations: number[] = [];
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      await assembler.assembleEmbodiedContext();
      durations.push(Date.now() - start);
    }

    durations.sort((a, b) => a - b);
    const p95 = durations[Math.floor(durations.length * 0.95)];

    assert.ok(p95 < 2000, `p95 should be within 2s deadline, got ${p95}ms`);
    assert.ok(durations.every((d) => d < 2000), `all runs should be within 2s, max=${durations[durations.length - 1]}ms`);
  });
});
