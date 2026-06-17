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

  it("runtime heartbeat auto-advances daily rhythm and surface owns heartbeat impulse context", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = new Date().toISOString();
      await runHeartbeatCycle(db, {
        workspaceRoot: "/test",
        requestedAt: now,
        trigger: "manual",
      });

      // T-GVS.R.3: impulse context is refreshed by the heartbeat surface, not the orchestrator.
      // Seed it here to verify the real-run gate recognizes a complete runtime path.
      const { writeImpulseContextArtifact } = await import("../../../src/storage/v8-state-stores.js");
      await writeImpulseContextArtifact(db, {
        id: `impulse_${now.slice(0, 10)}`,
        sceneType: "heartbeat",
        capabilityIntent: null,
        platformId: null,
        capabilityClass: null,
        impulseSource: "runtime_surface",
        impulseText: "test impulse",
        atmosphereText: "test atmosphere",
        expressionBoundaryConstraintsJson: JSON.stringify(["be concise"]),
        expressionBoundaryStyle: "direct",
        freshnessVersion: 1,
        createdAt: now,
        updatedAt: now,
        sourceRefs: [{ uri: "sn://impulse", family: "audit" as const, id: "impulse1", redactionClass: "none" as const, resolveStatus: "resolvable" as const }],
      });

      const result = await readLoopStatus(db);
      assert.equal(result.ok, true);
      if (result.ok) {
        // Heartbeat auto-advances closure → Quiet → Dream; surface provides impulse context.
        assert.equal(result.status.realRunHealth.gatePassed, true);
        assert.equal(result.status.realRunHealth.hasRealClosure, true);
        assert.equal(result.status.realRunHealth.seededStateDetected, false);
        assert.equal(result.status.realRunHealth.hasQuietArtifact, true);
        assert.equal(result.status.realRunHealth.hasDreamArtifact, true);
        assert.equal(result.status.realRunHealth.hasFreshImpulseContext, true);
        assert.equal(result.status.realRunHealth.missingStage, "none");
        assert.equal(result.status.overallStatus, "healthy");
      }
    } finally {
      db.close();
    }
  });

  it("full runtime path (heartbeat + auto daily rhythm) reports healthy", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = new Date().toISOString();
      const day = now.slice(0, 10);
      await runHeartbeatCycle(db, {
        workspaceRoot: "/test",
        requestedAt: now,
        trigger: "manual",
      });

      // Heartbeat now auto-advances closure → Quiet → Dream.
      // Seed impulse context and projection for full gate pass.
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
        payloadJson: JSON.stringify({ memoryText: "test memory", acceptedAt: now }),
      });

      const result = await readLoopStatus(db);
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.status.realRunHealth.gatePassed, true);
        assert.equal(result.status.realRunHealth.hasRealClosure, true);
        assert.equal(result.status.realRunHealth.hasQuietArtifact, true);
        assert.equal(result.status.realRunHealth.hasDreamArtifact, true);
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
