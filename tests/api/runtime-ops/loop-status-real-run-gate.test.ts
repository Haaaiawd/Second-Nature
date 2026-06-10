/**
 * LoopStatus Real-Run Gate — API-style tests (T-OBS.R.3)
 *
 * Validates: `readLoopStatus` consumes `checkRealRunHealth` and surfaces real-run
 * gaps as degraded states. Generic causal health cannot override a failed gate.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { readLoopStatus } from "../../../src/observability/loop-status.js";
import { runHeartbeatCycle } from "../../../src/core/second-nature/control-plane/heartbeat-orchestrator.js";
import { checkDailyRhythm } from "../../../src/core/second-nature/quiet-dream/daily-rhythm-scheduler.js";

describe("loop-status-real-run-gate", () => {
  it("empty state reports degraded real-run health", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const result = await readLoopStatus(db);
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.status.realRunHealth.gatePassed, false);
        assert.equal(result.status.realRunHealth.contractSmokeOnly, true);
        assert.equal(result.status.realRunHealth.hasRealClosure, false);
        // overallStatus must not be "healthy" when real-run gate fails
        assert.notEqual(result.status.overallStatus, "healthy");
        assert.ok(result.status.nextAction.includes("Real-run health degraded"));
      }
    } finally {
      db.close();
    }
  });

  it("runtime heartbeat without daily rhythm reports degraded (missing quiet)", async () => {
    const db = createStateDatabase(":memory:");
    try {
      await runHeartbeatCycle(db, {
        workspaceRoot: "/test",
        requestedAt: new Date().toISOString(),
        trigger: "manual",
      });

      const result = await readLoopStatus(db);
      assert.equal(result.ok, true);
      if (result.ok) {
        // Causal snapshot may be healthy, but real-run gate fails due to missing quiet/dream
        assert.equal(result.status.realRunHealth.gatePassed, false);
        assert.equal(result.status.realRunHealth.hasRealClosure, true);
        assert.equal(result.status.realRunHealth.seededStateDetected, false);
        assert.equal(result.status.realRunHealth.missingStage, "quiet");
        // overallStatus must not be healthy because real-run gate fails
        // (may be "stalled" from causal snapshot or "degraded" from real-run override)
        assert.ok(
          result.status.overallStatus !== "healthy",
          `expected non-healthy, got ${result.status.overallStatus}`
        );
        assert.ok(result.status.nextAction.includes("Real-run health degraded"));
      }
    } finally {
      db.close();
    }
  });

  it("full runtime path (heartbeat + daily rhythm) reports healthy", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = new Date().toISOString();
      const day = now.slice(0, 10);
      await runHeartbeatCycle(db, {
        workspaceRoot: "/test",
        requestedAt: now,
        trigger: "manual",
      });

      await checkDailyRhythm(db, { now, forceQuiet: true });

      // Seed impulse context and projection for full gate pass
      const { writeImpulseContextArtifact, writeLongTermMemoryProjection } = await import("../../../src/storage/v8-state-stores.js");
      await writeImpulseContextArtifact(db, {
        id: `impulse_${day}`,
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
        sourceRefs: [{ uri: "sn://impulse", family: "audit" as const, id: "impulse1", redactionClass: "none" as const, resolveStatus: "resolvable" as const }],
      });
      await writeLongTermMemoryProjection(db, {
        id: `proj_${day}_001`,
        createdAt: now,
        candidateId: `candidate_${day}_001`,
        topicKey: "test_topic",
        status: "active",
        sourceRefs: [{ uri: "sn://projection", family: "memory_projection" as const, id: "proj1", redactionClass: "none" as const, resolveStatus: "resolvable" as const }],
        redactionClass: "none",
        lifecycleStatus: "active",
        payloadJson: JSON.stringify({ memoryText: "test memory", acceptedAt: now }),
      });

      const result = await readLoopStatus(db);
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.status.realRunHealth.gatePassed, true);
        assert.equal(result.status.realRunHealth.hasRealClosure, true);
        assert.equal(result.status.realRunHealth.hasQuietArtifact, true);
        assert.equal(result.status.realRunHealth.seededStateDetected, false);
        assert.equal(result.status.realRunHealth.missingStage, "none");
        assert.equal(result.status.overallStatus, "healthy");
        assert.ok(result.status.nextAction.includes("No operator action required"));
      }
    } finally {
      db.close();
    }
  });
});
