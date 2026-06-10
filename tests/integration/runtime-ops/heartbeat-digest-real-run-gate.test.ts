/**
 * Heartbeat Digest Real-Run Gate — Integration tests (T-OBS.R.3)
 *
 * Validates: `heartbeat_digest` auto-embeds `checkRealRunHealth` when db is wired,
 * and agrees with `loop_status` on real-run health for the same workspace/day.
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
  it("digest defaults to unevaluated realRunHealth when db is not wired", async () => {
    const date = new Date().toISOString().slice(0, 10);
    const auditStore = new AppendOnlyAuditStore();

    const digest = await generateHeartbeatDigest(date, { auditStore });

    // Without db, realRunHealth should show unevaluated
    assert.equal(digest.realRunHealth.gatePassed, false);
    assert.ok(digest.realRunHealth.missingReason);
    assert.ok(digest.realRunHealth.missingReason.includes("no state DB wired"));
  });

  it("digest auto-embeds realRunHealth after full runtime path", async () => {
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

      // F6: Pass db to generateHeartbeatDigest — realRunHealth is auto-evaluated
      const digest = await generateHeartbeatDigest(date, { auditStore, db });

      // Verify auto-embedded realRunHealth agrees with direct checkRealRunHealth call
      const realRun = await checkRealRunHealth(db, date);
      assert.equal(realRun.ok, true);
      if (realRun.ok) {
        assert.equal(digest.realRunHealth.gatePassed, realRun.gate.gatePassed);
        assert.equal(digest.realRunHealth.hasRealClosure, realRun.gate.hasRealClosure);
        assert.equal(digest.realRunHealth.hasQuietArtifact, realRun.gate.hasQuietArtifact);
        assert.equal(digest.realRunHealth.seededStateDetected, realRun.gate.seededStateDetected);
      }

      // Note: gate may not pass because impulse context and projections may not exist
      // in this minimal test setup. The key assertion is that realRunHealth is auto-evaluated.
      assert.ok(digest.realRunHealth.missingStage !== undefined);
    } finally {
      db.close();
    }
  });

  it("digest auto-embeds seeded state detection when closure is manually inserted", async () => {
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

      // F6: Pass db — auto-evaluated realRunHealth should detect seeded state
      const digest = await generateHeartbeatDigest(date, { auditStore, db });

      assert.equal(digest.realRunHealth.seededStateDetected, true);
      assert.equal(digest.realRunHealth.gatePassed, false);
      assert.ok(digest.realRunHealth.missingReason);
    } finally {
      db.close();
    }
  });
});
