/**
 * LivingLoopHealthGate — Unit Tests (T-OBS.R.2)
 *
 * Validates: contract-smoke detection, real artifact detection,
 * missing stage identification, and explicit absence reasons.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { checkRealRunHealth } from "../../../src/observability/living-loop-health-gate.js";
import { writeActionClosureRecord, writeDailyRhythmState, writeHeartbeatCycleTrace, writeLoopStageEvent, writeImpulseContextArtifact, writeLongTermMemoryProjection } from "../../../src/storage/v8-state-stores.js";

async function seedClosure(db: ReturnType<typeof createStateDatabase>, day: string, withCycleTrace = true) {
  if (withCycleTrace) {
    await writeHeartbeatCycleTrace(db, {
      id: `cycle_${day}_001`,
      cycleSequence: 1,
      heartbeatStartedAt: `${day}T12:00:00Z`,
      inputCount: 0,
      outputCount: 1,
      status: "completed",
      sourceRefs: [
        { uri: "sn://heartbeat/cycle", family: "audit" as const, id: `cycle_${day}_001`, redactionClass: "none" as const, resolveStatus: "resolvable" as const },
      ],
    });
    // F3: write closure stage event to satisfy runtime-proof validation
    await writeLoopStageEvent(db, {
      id: `stage_${day}_closure_001`,
      cycleId: `cycle_${day}_001`,
      cycleSequence: 1,
      stage: "closure",
      status: "completed",
      reason: "closure_completed",
      sourceRefs: [
        { uri: "sn://test", family: "action_closure" as const, id: "c1", redactionClass: "none" as const, resolveStatus: "resolvable" as const },
      ],
      occurredAt: `${day}T12:00:00Z`,
    });
  }
  await writeActionClosureRecord(db, {
    id: `closure_${day}_001`,
    cycleId: `cycle_${day}_001`,
    status: "completed",
    reason: "closure_completed",
    sourceRefs: [
      { uri: "sn://test", family: "action_closure" as const, id: "c1", redactionClass: "none" as const, resolveStatus: "resolvable" as const },
    ],
    createdAt: `${day}T12:00:00Z`,
  });
}

async function seedImpulseContext(db: ReturnType<typeof createStateDatabase>, _day: string) {
  const now = new Date().toISOString();
  await writeImpulseContextArtifact(db, {
    id: `impulse_${_day}`,
    sceneType: "heartbeat",
    capabilityIntent: null,
    platformId: null,
    capabilityClass: null,
    impulseSource: "runtime",
    impulseText: "test impulse",
    atmosphereText: "test atmosphere",
    expressionBoundaryConstraintsJson: JSON.stringify(["be concise"]),
    expressionBoundaryStyle: "direct",
    freshnessVersion: 1,
    createdAt: now,
    updatedAt: now,
    sourceRefs: [
      { uri: `sn://impulse/${_day}`, family: "audit" as const, id: `impulse_${_day}`, redactionClass: "none" as const, resolveStatus: "resolvable" as const },
    ],
  });
}

async function seedProjection(db: ReturnType<typeof createStateDatabase>, day: string) {
  await writeLongTermMemoryProjection(db, {
    id: `proj_${day}_001`,
    createdAt: `${day}T12:00:00Z`,
    candidateId: `candidate_${day}_001`,
    topicKey: "test_topic",
    status: "active",
    sourceRefs: [
      { uri: `sn://projection/${day}`, family: "memory_projection" as const, id: `proj_${day}_001`, redactionClass: "none" as const, resolveStatus: "resolvable" as const },
    ],
    redactionClass: "none",
    lifecycleStatus: "active",
    payloadJson: JSON.stringify({ memoryText: "test memory", acceptedAt: `${day}T12:00:00Z` }),
  });
}

async function seedRhythm(db: ReturnType<typeof createStateDatabase>, day: string, quietStatus: string, dreamStatus: string) {
  await writeDailyRhythmState(db, {
    id: `rhythm_${day}`,
    day,
    quietStatus,
    dreamStatus,
    quietReason: null,
    dreamReason: null,
    sourceRefs: [
      { uri: `sn://rhythm/${day}`, family: "dream_run" as const, id: `rhythm_${day}`, redactionClass: "none" as const, resolveStatus: "resolvable" as const },
    ],
    updatedAt: `${day}T12:00:00Z`,
  });
}

describe("living-loop-health-gate", () => {
  it("detects contract-smoke-only when no artifacts exist", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const result = await checkRealRunHealth(db, "2026-06-05");
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.gate.contractSmokeOnly, true);
        assert.equal(result.gate.hasRealClosure, false);
        assert.equal(result.gate.hasQuietArtifact, false);
        assert.equal(result.gate.hasDreamArtifact, false);
        assert.equal(result.gate.seededStateDetected, false);
        assert.equal(result.gate.gatePassed, false);
        assert.equal(result.gate.missingStage, "closure");
        assert.ok(result.gate.missingReason?.includes("No ActionClosureRecord"));
      }
    } finally {
      db.close();
    }
  });

  it("detects real closure but missing quiet", async () => {
    const db = createStateDatabase(":memory:");
    try {
      await seedClosure(db, "2026-06-05");

      const result = await checkRealRunHealth(db, "2026-06-05");
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.gate.hasRealClosure, true);
        assert.equal(result.gate.seededStateDetected, false);
        assert.equal(result.gate.gatePassed, false);
        assert.equal(result.gate.hasQuietArtifact, false);
        assert.equal(result.gate.missingStage, "quiet");
        assert.ok(result.gate.missingReason?.includes("no QuietDailyReview"));
      }
    } finally {
      db.close();
    }
  });

  it("detects quiet but missing dream", async () => {
    const db = createStateDatabase(":memory:");
    try {
      await seedClosure(db, "2026-06-05");
      await seedRhythm(db, "2026-06-05", "completed", "not_due");

      const result = await checkRealRunHealth(db, "2026-06-05");
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.gate.hasRealClosure, true);
        assert.equal(result.gate.seededStateDetected, false);
        assert.equal(result.gate.gatePassed, false);
        assert.equal(result.gate.hasQuietArtifact, true);
        assert.equal(result.gate.hasDreamArtifact, false);
        assert.equal(result.gate.missingStage, "dream");
        assert.ok(result.gate.missingReason?.includes("no DreamConsolidationRun"));
      }
    } finally {
      db.close();
    }
  });

  it("reports all stages present", async () => {
    const db = createStateDatabase(":memory:");
    try {
      await seedClosure(db, "2026-06-05");
      await seedRhythm(db, "2026-06-05", "completed", "scheduled");
      await seedImpulseContext(db, "2026-06-05");
      await seedProjection(db, "2026-06-05");

      const result = await checkRealRunHealth(db, "2026-06-05");
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.gate.hasRealClosure, true);
        assert.equal(result.gate.hasQuietArtifact, true);
        assert.equal(result.gate.hasDreamArtifact, true);
        assert.equal(result.gate.hasFreshImpulseContext, true);
        assert.equal(result.gate.hasProjectionFeedback, true);
        assert.equal(result.gate.contractSmokeOnly, false);
        assert.equal(result.gate.seededStateDetected, false);
        assert.equal(result.gate.gatePassed, true);
        assert.equal(result.gate.missingStage, "none");
      }
    } finally {
      db.close();
    }
  });

  it("detects seeded state when closure lacks runtime cycle trace", async () => {
    const db = createStateDatabase(":memory:");
    try {
      await seedClosure(db, "2026-06-05", false); // no cycle trace

      const result = await checkRealRunHealth(db, "2026-06-05");
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.gate.hasRealClosure, true);
        assert.equal(result.gate.seededStateDetected, true);
        assert.equal(result.gate.gatePassed, false);
        assert.equal(result.gate.missingStage, "closure");
        assert.ok(result.gate.missingReason?.includes("Seeded state detected"));
      }
    } finally {
      db.close();
    }
  });
});
