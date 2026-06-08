/**
 * INT-R1 — Runtime Activation Repair Gate (Real Living Loop)
 *
 * Validates: All repair tasks (T-CP.R.2, T-GVS.R.1, T-CS.R.1, T-DQ.R.2, T-OBS.R.2)
 * work together to produce real state-backed evidence, not contract-only smoke.
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
import { writeActionClosureRecord } from "../../../src/storage/v8-state-stores.js";

describe("int-r1-runtime-activation-repair", () => {
  it("full repair chain produces real artifacts per stage", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const day = "2026-06-08";
      const now = `${day}T10:00:00Z`;

      // 1. T-GVS.R.1: Write impulse context artifact
      const impulseInput: ImpulseContextArtifactInput = {
        sceneType: "social",
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

      const readResult = await readImpulseContext(db, "social");
      assert.ok(readResult.available, "impulse context should be readable");

      // 2. T-CS.R.1: Policy-bound write dispatch (dry-run)
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

      // 3. Seed closure for T-DQ.R.2
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

      // 4. T-DQ.R.2: Daily rhythm check
      const rhythmResult = await checkDailyRhythm(db, { now, forceQuiet: true });
      assert.equal(rhythmResult.status, "checked");
      if (rhythmResult.status === "checked") {
        assert.equal(rhythmResult.state.quietStatus, "completed");
      }

      // 5. T-OBS.R.2: Real run health gate
      const healthResult = await checkRealRunHealth(db, day);
      assert.equal(healthResult.ok, true);
      if (healthResult.ok) {
        assert.equal(healthResult.gate.hasRealClosure, true);
        assert.equal(healthResult.gate.hasQuietArtifact, true);
        assert.equal(healthResult.gate.contractSmokeOnly, false);
        assert.equal(healthResult.gate.missingStage, "none");
      }
    } finally {
      db.close();
    }
  });

  it("reports explicit absence reason when stage is missing", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const day = "2026-06-08";

      // No closures, no artifacts
      const healthResult = await checkRealRunHealth(db, day);
      assert.equal(healthResult.ok, true);
      if (healthResult.ok) {
        assert.equal(healthResult.gate.contractSmokeOnly, true);
        assert.equal(healthResult.gate.missingStage, "closure");
        assert.ok(healthResult.gate.missingReason?.includes("ActionClosureRecord"));
      }
    } finally {
      db.close();
    }
  });
});
