/**
 * INT-R1 — Runtime Activation Repair Gate (Real Living Loop)
 *
 * Validates: All repair tasks (T-CP.R.2, T-GVS.R.1, T-CS.R.1, T-DQ.R.2, T-OBS.R.2)
 * work together to produce real state-backed evidence, not contract-only smoke.
 *
 * T-VERIFY.R.1 fix: The gate must fail when closure is manually seeded instead
 * of produced by the runtime heartbeat path. Only runtime-produced closure/no-action
 * backed by cycle trace + stage events counts as valid proof.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { runHeartbeatCycle } from "../../../src/core/second-nature/control-plane/heartbeat-orchestrator.js";
import { writeImpulseContext, type ImpulseContextArtifactInput } from "../../../src/core/second-nature/guidance/impulse-context-writer.js";
import { readImpulseContext } from "../../../src/core/second-nature/guidance/impulse-context-reader.js";
import { dispatchPolicyBoundWrite } from "../../../src/connectors/base/policy-bound-write-dispatch.js";
import { checkDailyRhythm } from "../../../src/core/second-nature/quiet-dream/daily-rhythm-scheduler.js";
import { checkRealRunHealth } from "../../../src/observability/living-loop-health-gate.js";
import { readLoopStatus } from "../../../src/observability/loop-status.js";
import { writeActionClosureRecord, writeLongTermMemoryProjection } from "../../../src/storage/v8-state-stores.js";

describe("int-r1-runtime-activation-repair", () => {
  it("full repair chain produces real runtime artifacts per stage", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = new Date().toISOString();
      const day = now.slice(0, 10);

      // 1. T-CP.R.2: Run real heartbeat cycle — produces runtime closure/no-action
      const cycleResult = await runHeartbeatCycle(db, {
        workspaceRoot: "/test",
        requestedAt: now,
        trigger: "manual",
      });
      assert.ok(
        !("status" in cycleResult && cycleResult.status === "degraded"),
        "heartbeat cycle should not degrade"
      );
      assert.ok(
        "cycleId" in cycleResult && cycleResult.cycleId,
        "heartbeat cycle should produce a cycleId"
      );
      assert.ok(
        "closureRef" in cycleResult && cycleResult.closureRef,
        "heartbeat cycle should produce a closure ref"
      );

      // 2. T-GVS.R.1: Write and read impulse context artifact
      const impulseInput: ImpulseContextArtifactInput = {
        sceneType: "heartbeat",
        impulseResult: {
          impulse: { kind: "social", text: "Be warm", reviewStatus: "approved" },
          source: "intent_kind",
          capabilityClass: null,
        },
        atmosphereText: "Open",
        expressionBoundaryConstraints: ["avoid_sarcasm"],
      };
      const writeResult = await writeImpulseContext(db, impulseInput, { now });
      assert.ok("id" in writeResult, "impulse context should persist");

      const readResult = await readImpulseContext(db, "heartbeat");
      assert.ok(readResult.available, "impulse context should be readable");

      // 3. T-CS.R.1: Policy-bound write dispatch (dry-run)
      const dryRunResult = await dispatchPolicyBoundWrite(
        {
          platformId: "moltbook",
          intent: "post.publish",
          payload: { text: "Hello" },
          idempotencyKey: "dry-001",
          decisionId: "dec-001",
          intentId: "int-001",
          policyProof: { decisionId: "dec-001", decision: "allow", dryRun: true },
        },
        async () => ({ status: "success" as const, data: {}, metadata: { platformId: "moltbook", channel: "api_rest", latencyMs: 0 } }),
      );
      assert.equal(dryRunResult.status, "dry_run");

      // 4. T-DQ.R.2: Daily rhythm check
      const rhythmResult = await checkDailyRhythm(db, { now, forceQuiet: true });
      assert.equal(rhythmResult.status, "checked");
      if (rhythmResult.status === "checked") {
        assert.equal(rhythmResult.state.quietStatus, "completed");
      }

      // 4b. Seed accepted projection for health gate completeness
      await writeLongTermMemoryProjection(db, {
        id: `proj_${day}_001`,
        createdAt: now,
        candidateId: `candidate_${day}_001`,
        topicKey: "test_topic",
        status: "active",
        sourceRefs: [{ uri: "sn://projection", family: "memory_projection", id: "proj1", redactionClass: "none", resolveStatus: "resolvable" }],
        redactionClass: "none",
        lifecycleStatus: "active",
        payloadJson: JSON.stringify({ memoryText: "test memory", acceptedAt: now }),
      });

      // 5. T-OBS.R.2: Real run health gate — must PASS for runtime-produced evidence
      const healthResult = await checkRealRunHealth(db, day);
      assert.equal(healthResult.ok, true);
      if (healthResult.ok) {
        assert.equal(healthResult.gate.hasRealClosure, true);
        assert.equal(healthResult.gate.seededStateDetected, false);
        assert.equal(healthResult.gate.gatePassed, true);
        assert.equal(healthResult.gate.contractSmokeOnly, false);
        assert.equal(healthResult.gate.hasQuietArtifact, true);
        assert.equal(healthResult.gate.missingStage, "none");
      }

      // 6. loop_status should observe the closure
      const loopStatus = await readLoopStatus(db);
      assert.equal(loopStatus.ok, true);
      if (loopStatus.ok) {
        assert.ok(
          loopStatus.status.stageSummaries.some((s) => s.stage === "closure"),
          "loop_status should include closure stage summary"
        );
      }
    } finally {
      db.close();
    }
  });

  it("seeded-only closure fails as not valid runtime proof", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = new Date().toISOString();
      const day = now.slice(0, 10);

      // Manually seed a closure WITHOUT running heartbeat — simulates false-green
      await writeActionClosureRecord(db, {
        id: `closure_${day}_001`,
        cycleId: `cycle_${day}_001`,
        status: "completed",
        reason: "closure_completed",
        sourceRefs: [
          { uri: "sn://test", family: "action_closure" as const, id: "c1", redactionClass: "none" as const, resolveStatus: "resolvable" as const },
        ],
        createdAt: now,
      });

      // Gate must detect seeded state and fail
      const healthResult = await checkRealRunHealth(db, day);
      assert.equal(healthResult.ok, true);
      if (healthResult.ok) {
        assert.equal(healthResult.gate.hasRealClosure, true);
        assert.equal(healthResult.gate.seededStateDetected, true);
        assert.equal(healthResult.gate.gatePassed, false);
        assert.equal(healthResult.gate.missingStage, "closure");
        assert.ok(
          healthResult.gate.missingReason?.includes("Seeded state detected"),
          "missing reason should explain seeded state"
        );
      }
    } finally {
      db.close();
    }
  });

  it("missing all runtime artifacts fails with explicit reason", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const day = new Date().toISOString().slice(0, 10);

      // No closures, no artifacts
      const healthResult = await checkRealRunHealth(db, day);
      assert.equal(healthResult.ok, true);
      if (healthResult.ok) {
        assert.equal(healthResult.gate.contractSmokeOnly, true);
        assert.equal(healthResult.gate.seededStateDetected, false);
        assert.equal(healthResult.gate.gatePassed, false);
        assert.equal(healthResult.gate.hasRealClosure, false);
        assert.equal(healthResult.gate.missingStage, "closure");
        assert.ok(
          healthResult.gate.missingReason?.includes("No ActionClosureRecord"),
          "missing reason should explain missing closure"
        );
      }
    } finally {
      db.close();
    }
  });
});
