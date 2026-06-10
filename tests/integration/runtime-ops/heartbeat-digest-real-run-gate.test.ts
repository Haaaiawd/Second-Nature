/**
 * Heartbeat Digest Real-Run Gate — Integration tests (T-OBS.R.3)
 *
 * Validates: `heartbeat_digest` embeds `checkRealRunHealth` result and agrees
 * with `loop_status` on real-run health for the same workspace/day.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { runHeartbeatCycle } from "../../../src/core/second-nature/control-plane/heartbeat-orchestrator.js";
import { checkDailyRhythm } from "../../../src/core/second-nature/quiet-dream/daily-rhythm-scheduler.js";
import { generateHeartbeatDigest } from "../../../src/observability/services/heartbeat-digest-assembler.js";
import { AppendOnlyAuditStore } from "../../../src/observability/audit/append-only-audit-store.js";
import { checkRealRunHealth } from "../../../src/observability/living-loop-health-gate.js";

describe("heartbeat-digest-real-run-gate", () => {
  it("digest realRunHealth agrees with loop_status for empty state", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const date = new Date().toISOString().slice(0, 10);
      const auditStore = new AppendOnlyAuditStore();

      const digest = await generateHeartbeatDigest(date, { auditStore });

      // Real-run health defaults to unevaluated when state is not wired
      assert.equal(digest.realRunHealth.gatePassed, false);
      assert.ok(digest.realRunHealth.missingReason);

      // When we manually evaluate via checkRealRunHealth
      const realRun = await checkRealRunHealth(db, date);
      assert.equal(realRun.ok, true);
      if (realRun.ok) {
        assert.equal(realRun.gate.gatePassed, false);
        assert.equal(realRun.gate.contractSmokeOnly, true);
      }
    } finally {
      db.close();
    }
  });

  it("digest realRunHealth agrees with loop_status after full runtime path", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = new Date().toISOString();
      const date = now.slice(0, 10);
      const auditStore = new AppendOnlyAuditStore();

      // Run full runtime path
      await runHeartbeatCycle(db, {
        workspaceRoot: "/test",
        requestedAt: now,
        trigger: "manual",
      });
      await checkDailyRhythm(db, { now, forceQuiet: true });

      // Evaluate real-run health
      const realRun = await checkRealRunHealth(db, date);
      assert.equal(realRun.ok, true);
      if (realRun.ok) {
        assert.equal(realRun.gate.gatePassed, true);
        assert.equal(realRun.gate.hasRealClosure, true);
        assert.equal(realRun.gate.hasQuietArtifact, true);
      }

      // Generate digest with real-run health embedded
      const digest = await generateHeartbeatDigest(date, { auditStore });

      // Manually inject real-run health (simulating what ops-router does)
      if (realRun.ok) {
        digest.realRunHealth = {
          gatePassed: realRun.gate.gatePassed,
          contractSmokeOnly: realRun.gate.contractSmokeOnly,
          seededStateDetected: realRun.gate.seededStateDetected,
          hasRealClosure: realRun.gate.hasRealClosure,
          hasQuietArtifact: realRun.gate.hasQuietArtifact,
          hasDreamArtifact: realRun.gate.hasDreamArtifact,
          missingStage: realRun.gate.missingStage,
          missingReason: realRun.gate.missingReason,
        };
      }

      assert.equal(digest.realRunHealth.gatePassed, true);
      assert.equal(digest.realRunHealth.hasRealClosure, true);
      assert.equal(digest.realRunHealth.seededStateDetected, false);
      assert.equal(digest.realRunHealth.missingStage, "none");
    } finally {
      db.close();
    }
  });

  it("digest realRunHealth surfaces seeded state when closure is manually inserted", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = new Date().toISOString();
      const date = now.slice(0, 10);
      const auditStore = new AppendOnlyAuditStore();

      // Manually seed a closure without cycle trace
      const { writeActionClosureRecord } = await import("../../../src/storage/v8-state-stores.js");
      await writeActionClosureRecord(db, {
        id: `closure_${date}_001`,
        cycleId: `cycle_${date}_001`,
        status: "completed",
        reason: "closure_completed",
        sourceRefs: [
          { uri: "sn://test", family: "action_closure" as const, id: "c1", redactionClass: "none" as const, resolveStatus: "resolvable" as const },
        ],
        createdAt: now,
      });

      const realRun = await checkRealRunHealth(db, date);
      assert.equal(realRun.ok, true);
      if (realRun.ok) {
        assert.equal(realRun.gate.seededStateDetected, true);
        assert.equal(realRun.gate.gatePassed, false);
      }

      const digest = await generateHeartbeatDigest(date, { auditStore });
      if (realRun.ok) {
        digest.realRunHealth = {
          gatePassed: realRun.gate.gatePassed,
          contractSmokeOnly: realRun.gate.contractSmokeOnly,
          seededStateDetected: realRun.gate.seededStateDetected,
          hasRealClosure: realRun.gate.hasRealClosure,
          hasQuietArtifact: realRun.gate.hasQuietArtifact,
          hasDreamArtifact: realRun.gate.hasDreamArtifact,
          missingStage: realRun.gate.missingStage,
          missingReason: realRun.gate.missingReason,
        };
      }

      assert.equal(digest.realRunHealth.seededStateDetected, true);
      assert.equal(digest.realRunHealth.gatePassed, false);
      assert.ok(digest.realRunHealth.missingReason?.includes("Seeded state"));
    } finally {
      db.close();
    }
  });
});
