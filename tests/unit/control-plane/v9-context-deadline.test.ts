/**
 * V9 Context Assembly Deadline — Unit Tests (T2.2.3)
 *
 * Validates:
 * - 2s heartbeat deadline: assembly completes within hard deadline
 * - per-slice timeout: non-critical slice timeout is shorter than critical
 * - non-critical slice hang → degraded, other slices remain loaded
 * - latency stage event emitted with correct timing data
 * - parallel assembly: total time ≈ max(slice times), not sum
 * - continuity unavailable carries explicit reason
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/control-context-system.detail.md §3.3`
 * - PRD §6.1
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createV9EmbodiedContextAssembler } from "../../../src/core/second-nature/control-plane/v9-embodied-context-assembler.js";
import type {
  ContextAssemblyLatencyReport,
  ContextSlice,
  ContinuityReadPort,
} from "../../../src/shared/types/v9-contracts.js";
import type { ActivityThreadPort } from "../../../src/core/second-nature/control-plane/activity-thread-coordinator.js";
import type { EmbodiedContextStatePort } from "../../../src/storage/services/embodied-context-state-port.js";
import type { AffordanceAssembler } from "../../../src/core/second-nature/body/tool-affordance/affordance-assembler.js";
import type { AffordanceMap, SelfHealthSnapshot } from "../../../src/shared/types/v7-entities.js";
import type { CharacterLoaderPort, SelfHealthProvider } from "../../../src/core/second-nature/control-plane/v9-embodied-context-assembler.js";

// ───────────────────────────────────────────────────────────────
// Mock factories
// ───────────────────────────────────────────────────────────────

function makeMockStatePort(opts: {
  identityDelay?: number;
  goalsDelay?: number;
  interactionDelay?: number;
  experienceDelay?: number;
  dreamDelay?: number;
  identityFail?: boolean;
}): EmbodiedContextStatePort {
  const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  return {
    async loadIdentityProfile() {
      if (opts.identityDelay) await delay(opts.identityDelay);
      if (opts.identityFail) return { status: "degraded", reason: "identity_unavailable" };
      return {
        status: "loaded",
        data: {
          profileId: "default",
          name: "Test",
          coreTraits: [],
          bodyIntuitionSummary: "test",
          updatedAt: new Date().toISOString(),
        },
      };
    },
    async listActiveGoals() {
      if (opts.goalsDelay) await delay(opts.goalsDelay);
      return { status: "loaded", data: [] };
    },
    async loadRecentInteractionSnapshot() {
      if (opts.interactionDelay) await delay(opts.interactionDelay);
      return { status: "loaded", data: [] };
    },
    async loadToolExperienceSlice() {
      if (opts.experienceDelay) await delay(opts.experienceDelay);
      return { status: "loaded", data: [] };
    },
    async loadAcceptedDreamProjection() {
      if (opts.dreamDelay) await delay(opts.dreamDelay);
      return { status: "loaded", data: [] };
    },
  } as unknown as EmbodiedContextStatePort;
}

function makeMockAffordanceAssembler(opts: {
  delay?: number;
  fail?: boolean;
}): AffordanceAssembler {
  const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  return {
    async assembleAffordanceMap() {
      if (opts.delay) await delay(opts.delay);
      if (opts.fail) throw new Error("affordance_fail");
      return {} as AffordanceMap;
    },
  } as unknown as AffordanceAssembler;
}

function makeMockContinuityReadPort(opts: {
  cardDelay?: number;
  cardFail?: boolean;
  memoryDelay?: number;
  proceduralDelay?: number;
  routineDelay?: number;
}): ContinuityReadPort {
  const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  return {
    async loadSelfContinuityCard() {
      if (opts.cardDelay) await delay(opts.cardDelay);
      if (opts.cardFail) return { reason: "continuity_unavailable" };
      return {
        id: "card-1",
        workspaceRoot: "",
        bodyIntuition: "test",
        summary: "test card",
        sourceRefs: [],
        updatedAt: new Date().toISOString(),
      };
    },
    async loadActiveMemoryProjections() {
      if (opts.memoryDelay) await delay(opts.memoryDelay);
      return { projections: [] };
    },
    async loadActiveProceduralProjections() {
      if (opts.proceduralDelay) await delay(opts.proceduralDelay);
      return { projections: [] };
    },
    async loadRoutineList() {
      if (opts.routineDelay) await delay(opts.routineDelay);
      return { routines: [] };
    },
  } as unknown as ContinuityReadPort;
}

function makeMockCharacterLoader(opts: { delay?: number; fail?: boolean }): CharacterLoaderPort {
  const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  return {
    async loadActiveCharacterFrame() {
      if (opts.delay) await delay(opts.delay);
      if (opts.fail) return { degraded: { reason: "character_frame_deferred", code: "no_frame" } };
      return {
        pointer: {
          frameId: "frame-1",
          summary: "test",
          contestPrompt: "",
          sourceRefs: [],
          status: "active" as const,
        },
        projection: {
          frameId: "frame-1",
          text: "test",
          contestPrompt: "",
          sourceRefs: [],
          status: "active" as const,
        },
      };
    },
  };
}

function makeMockActivityThreadPort(opts: { delay?: number; fail?: boolean }): ActivityThreadPort {
  const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  return {
    async loadActivityThreads() {
      if (opts.delay) await delay(opts.delay);
      if (opts.fail) return { status: "degraded", data: [], reason: "threads_unavailable" };
      return { status: "loaded", data: [] };
    },
  } as unknown as ActivityThreadPort;
}

function makeMockSelfHealthProvider(opts: { delay?: number; unavailable?: boolean }): SelfHealthProvider {
  const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  return {
    async loadSelfHealth() {
      if (opts.delay) await delay(opts.delay);
      if (opts.unavailable) return { status: "degraded", reason: "health_unavailable" };
      return {
        status: "loaded",
        data: {
          snapshotId: "snap-1",
          dimensions: {},
          checkedAt: new Date().toISOString(),
        } as SelfHealthSnapshot,
      };
    },
  };
}

// ───────────────────────────────────────────────────────────────
// Tests
// ───────────────────────────────────────────────────────────────

describe("T2.2.3 Context Assembly Deadline", () => {
  it("completes within hard deadline when all slices are fast", async () => {
    const assembler = createV9EmbodiedContextAssembler({
      statePort: makeMockStatePort({}),
      affordanceAssembler: makeMockAffordanceAssembler({}),
      continuityReadPort: makeMockContinuityReadPort({}),
      characterLoader: makeMockCharacterLoader({}),
      activityThreadPort: makeMockActivityThreadPort({}),
      selfHealthProvider: makeMockSelfHealthProvider({}),
      options: { hardDeadlineMs: 2000, criticalSliceTimeoutMs: 1500, nonCriticalSliceTimeoutMs: 600 },
    });

    const start = Date.now();
    const ctx = await assembler.assembleEmbodiedContext();
    const elapsed = Date.now() - start;

    assert.ok(elapsed < 500, `assembly should complete quickly, took ${elapsed}ms`);
    assert.equal(ctx.identity.status, "loaded");
    assert.equal(ctx.goals.status, "loaded");
    assert.equal(ctx.affordanceMap.status, "loaded");
    assert.equal(ctx.selfContinuityCard.status, "loaded");
  });

  it("degrades non-critical slice that times out, preserves other loaded slices", async () => {
    const assembler = createV9EmbodiedContextAssembler({
      statePort: makeMockStatePort({}),
      affordanceAssembler: makeMockAffordanceAssembler({}),
      continuityReadPort: makeMockContinuityReadPort({
        cardDelay: 2000, // will exceed nonCriticalTimeout
      }),
      characterLoader: makeMockCharacterLoader({}),
      activityThreadPort: makeMockActivityThreadPort({}),
      selfHealthProvider: makeMockSelfHealthProvider({}),
      options: { hardDeadlineMs: 2000, criticalSliceTimeoutMs: 1500, nonCriticalSliceTimeoutMs: 100 },
    });

    const start = Date.now();
    const ctx = await assembler.assembleEmbodiedContext();
    const elapsed = Date.now() - start;

    // Should complete well within 2s because the slow slice times out at 100ms
    assert.ok(elapsed < 1000, `assembly should complete within deadline, took ${elapsed}ms`);

    // The slow slice should be degraded
    assert.equal(ctx.selfContinuityCard.status, "degraded");
    assert.ok(ctx.selfContinuityCard.reason);
    assert.equal(ctx.selfContinuityCard.reason, "slice_timeout");

    // Other slices should remain loaded
    assert.equal(ctx.identity.status, "loaded");
    assert.equal(ctx.goals.status, "loaded");
    assert.equal(ctx.affordanceMap.status, "loaded");
    assert.equal(ctx.characterFramePointer.status, "loaded");
  });

  it("emits latency stage event with correct data", async () => {
    const reports: ContextAssemblyLatencyReport[] = [];
    const stageEventSink = {
      recordContextAssemblyLatency(report: ContextAssemblyLatencyReport) {
        reports.push(report);
      },
    };

    const assembler = createV9EmbodiedContextAssembler({
      statePort: makeMockStatePort({}),
      affordanceAssembler: makeMockAffordanceAssembler({}),
      continuityReadPort: makeMockContinuityReadPort({
        cardDelay: 2000,
      }),
      characterLoader: makeMockCharacterLoader({}),
      activityThreadPort: makeMockActivityThreadPort({}),
      selfHealthProvider: makeMockSelfHealthProvider({}),
      stageEventSink,
      options: { hardDeadlineMs: 2000, criticalSliceTimeoutMs: 1500, nonCriticalSliceTimeoutMs: 100 },
    });

    await assembler.assembleEmbodiedContext();

    assert.equal(reports.length, 1);
    const report = reports[0];
    assert.ok(report.totalDurationMs >= 0);
    assert.equal(report.hardDeadlineMs, 2000);
    assert.equal(report.withinDeadline, true);
    assert.ok(report.sliceTimings.identity >= 0);
    assert.ok(report.sliceTimings.selfContinuityCard >= 0);
    assert.ok(report.degradedSlices.includes("selfContinuityCard"));
    assert.ok(report.timedOutSlices.includes("selfContinuityCard"));
  });

  it("parallel assembly: total time ≈ max(slice times), not sum", async () => {
    // All slices take ~100ms. If serial, total would be ~1300ms (13 slices × 100ms).
    // If parallel, total should be ~100ms.
    const assembler = createV9EmbodiedContextAssembler({
      statePort: makeMockStatePort({ identityDelay: 100, goalsDelay: 100, interactionDelay: 100, experienceDelay: 100, dreamDelay: 100 }),
      affordanceAssembler: makeMockAffordanceAssembler({ delay: 100 }),
      continuityReadPort: makeMockContinuityReadPort({
        cardDelay: 100,
        memoryDelay: 100,
        proceduralDelay: 100,
        routineDelay: 100,
      }),
      characterLoader: makeMockCharacterLoader({ delay: 100 }),
      activityThreadPort: makeMockActivityThreadPort({ delay: 100 }),
      selfHealthProvider: makeMockSelfHealthProvider({ delay: 100 }),
      options: { hardDeadlineMs: 2000, criticalSliceTimeoutMs: 1500, nonCriticalSliceTimeoutMs: 1000 },
    });

    const start = Date.now();
    await assembler.assembleEmbodiedContext();
    const elapsed = Date.now() - start;

    // Should be ~100-200ms (parallel), not ~1300ms (serial)
    assert.ok(elapsed < 500, `parallel assembly should be fast, took ${elapsed}ms (expected <500ms)`);
  });

  it("continuity unavailable carries explicit reason", async () => {
    const assembler = createV9EmbodiedContextAssembler({
      statePort: makeMockStatePort({}),
      affordanceAssembler: makeMockAffordanceAssembler({}),
      continuityReadPort: makeMockContinuityReadPort({ cardFail: true }),
      characterLoader: makeMockCharacterLoader({}),
      activityThreadPort: makeMockActivityThreadPort({}),
      selfHealthProvider: makeMockSelfHealthProvider({}),
      options: { hardDeadlineMs: 2000, criticalSliceTimeoutMs: 1500, nonCriticalSliceTimeoutMs: 600 },
    });

    const ctx = await assembler.assembleEmbodiedContext();

    assert.equal(ctx.selfContinuityCard.status, "degraded");
    assert.equal(ctx.selfContinuityCard.reason, "continuity_unavailable");
  });

  it("critical slice timeout degrades that slice but preserves non-critical", async () => {
    const assembler = createV9EmbodiedContextAssembler({
      statePort: makeMockStatePort({ identityDelay: 2000 }),
      affordanceAssembler: makeMockAffordanceAssembler({}),
      continuityReadPort: makeMockContinuityReadPort({}),
      characterLoader: makeMockCharacterLoader({}),
      activityThreadPort: makeMockActivityThreadPort({}),
      selfHealthProvider: makeMockSelfHealthProvider({}),
      options: { hardDeadlineMs: 2000, criticalSliceTimeoutMs: 100, nonCriticalSliceTimeoutMs: 600 },
    });

    const start = Date.now();
    const ctx = await assembler.assembleEmbodiedContext();
    const elapsed = Date.now() - start;

    assert.ok(elapsed < 1000, `assembly should complete within deadline, took ${elapsed}ms`);

    // Identity (critical) should timeout
    assert.equal(ctx.identity.status, "degraded");
    assert.equal(ctx.identity.reason, "slice_timeout");

    // Non-critical slices should remain loaded
    assert.equal(ctx.selfContinuityCard.status, "loaded");
    assert.equal(ctx.affordanceMap.status, "loaded");
  });

  it("affordance assembly failure degrades affordanceMap slice only", async () => {
    const assembler = createV9EmbodiedContextAssembler({
      statePort: makeMockStatePort({}),
      affordanceAssembler: makeMockAffordanceAssembler({ fail: true }),
      continuityReadPort: makeMockContinuityReadPort({}),
      characterLoader: makeMockCharacterLoader({}),
      activityThreadPort: makeMockActivityThreadPort({}),
      selfHealthProvider: makeMockSelfHealthProvider({}),
      options: { hardDeadlineMs: 2000, criticalSliceTimeoutMs: 1500, nonCriticalSliceTimeoutMs: 600 },
    });

    const ctx = await assembler.assembleEmbodiedContext();

    assert.equal(ctx.affordanceMap.status, "degraded");
    assert.ok(ctx.affordanceMap.reason?.startsWith("affordance_assembly_failed"));
    assert.equal(ctx.identity.status, "loaded");
    assert.equal(ctx.selfContinuityCard.status, "loaded");
  });

  it("selfHealth provider unavailable degrades selfHealth slice with explicit reason", async () => {
    const assembler = createV9EmbodiedContextAssembler({
      statePort: makeMockStatePort({}),
      affordanceAssembler: makeMockAffordanceAssembler({}),
      continuityReadPort: makeMockContinuityReadPort({}),
      characterLoader: makeMockCharacterLoader({}),
      activityThreadPort: makeMockActivityThreadPort({}),
      // No selfHealthProvider — should degrade with "self_health_provider_unavailable"
      options: { hardDeadlineMs: 2000, criticalSliceTimeoutMs: 1500, nonCriticalSliceTimeoutMs: 600 },
    });

    const ctx = await assembler.assembleEmbodiedContext();

    assert.equal(ctx.selfHealth.status, "degraded");
    assert.equal(ctx.selfHealth.reason, "self_health_provider_unavailable");
  });

  it("activity threads blocked status is preserved", async () => {
    const assembler = createV9EmbodiedContextAssembler({
      statePort: makeMockStatePort({}),
      affordanceAssembler: makeMockAffordanceAssembler({}),
      continuityReadPort: makeMockContinuityReadPort({}),
      characterLoader: makeMockCharacterLoader({}),
      activityThreadPort: makeMockActivityThreadPort({ fail: true }),
      selfHealthProvider: makeMockSelfHealthProvider({}),
      options: { hardDeadlineMs: 2000, criticalSliceTimeoutMs: 1500, nonCriticalSliceTimeoutMs: 600 },
    });

    const ctx = await assembler.assembleEmbodiedContext();

    assert.equal(ctx.activityThreads.status, "degraded");
    assert.equal(ctx.activityThreads.reason, "threads_unavailable");
  });

  it("multiple slices timing out all appear in latency report", async () => {
    const reports: ContextAssemblyLatencyReport[] = [];
    const stageEventSink = {
      recordContextAssemblyLatency(report: ContextAssemblyLatencyReport) {
        reports.push(report);
      },
    };

    const assembler = createV9EmbodiedContextAssembler({
      statePort: makeMockStatePort({}),
      affordanceAssembler: makeMockAffordanceAssembler({}),
      continuityReadPort: makeMockContinuityReadPort({
        cardDelay: 2000,
        memoryDelay: 2000,
        routineDelay: 2000,
      }),
      characterLoader: makeMockCharacterLoader({ delay: 2000 }),
      activityThreadPort: makeMockActivityThreadPort({ delay: 2000 }),
      selfHealthProvider: makeMockSelfHealthProvider({ delay: 2000 }),
      stageEventSink,
      options: { hardDeadlineMs: 2000, criticalSliceTimeoutMs: 1500, nonCriticalSliceTimeoutMs: 100 },
    });

    await assembler.assembleEmbodiedContext();

    const report = reports[0];
    assert.ok(report.degradedSlices.length >= 5, `expected >=5 degraded slices, got ${report.degradedSlices.length}`);
    assert.ok(report.timedOutSlices.includes("selfContinuityCard"));
    assert.ok(report.timedOutSlices.includes("activeMemoryProjections"));
    assert.ok(report.timedOutSlices.includes("routineList"));
    assert.ok(report.timedOutSlices.includes("characterFrame"));
    assert.ok(report.timedOutSlices.includes("activityThreads"));
  });

  it("withinDeadline is false when total exceeds hard deadline", async () => {
    // This test uses very short timeouts to simulate exceeding deadline
    // We can't actually exceed 2000ms in a unit test, but we can set a very low hardDeadlineMs
    const reports: ContextAssemblyLatencyReport[] = [];
    const stageEventSink = {
      recordContextAssemblyLatency(report: ContextAssemblyLatencyReport) {
        reports.push(report);
      },
    };

    const assembler = createV9EmbodiedContextAssembler({
      statePort: makeMockStatePort({ identityDelay: 50 }),
      affordanceAssembler: makeMockAffordanceAssembler({ delay: 50 }),
      continuityReadPort: makeMockContinuityReadPort({}),
      characterLoader: makeMockCharacterLoader({}),
      activityThreadPort: makeMockActivityThreadPort({}),
      selfHealthProvider: makeMockSelfHealthProvider({}),
      stageEventSink,
      options: { hardDeadlineMs: 10, criticalSliceTimeoutMs: 2000, nonCriticalSliceTimeoutMs: 2000 },
    });

    await assembler.assembleEmbodiedContext();

    const report = reports[0];
    // With hardDeadlineMs=10 and slices taking 50ms, total > 10ms
    assert.equal(report.hardDeadlineMs, 10);
    // withinDeadline should be false since total > 10ms
    assert.equal(report.withinDeadline, false);
  });
});
