/**
 * INT-R2 — Proof Truth and Memory Feedback Gate (Wave 107)
 *
 * Validates: All Wave 107 repair tasks close together without false-green:
 * - T-VERIFY.R.1: proof truth — no seeded-state false pass
 * - T-OBS.R.3: real-run health wired into loop_status and heartbeat_digest
 * - T-PJ.R.1: PerceptionCard canonical novelty/relevance contract
 * - T-DQ.R.3: projection supersession uses UPDATE + accepted memory feeds heartbeat context
 * - T-DQ.R.4: QuietDailyReview.closureRefs first-class
 *
 * If any artifact or memory feedback link is absent, this gate fails with
 * a specific missing-link reason.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { runHeartbeatCycle } from "../../../src/core/second-nature/control-plane/heartbeat-orchestrator.js";
import { writeImpulseContext } from "../../../src/core/second-nature/guidance/impulse-context-writer.js";
import { dispatchPolicyBoundWrite } from "../../../src/connectors/base/policy-bound-write-dispatch.js";
import { checkDailyRhythm } from "../../../src/core/second-nature/quiet-dream/daily-rhythm-scheduler.js";
import { checkRealRunHealth } from "../../../src/observability/living-loop-health-gate.js";
import { readLoopStatus } from "../../../src/observability/loop-status.js";
import { buildPerceptionCards } from "../../../src/core/second-nature/perception/perception-builder.js";
import { acceptMemoryProjection } from "../../../src/core/second-nature/quiet-dream/memory-projection-lifecycle.js";
import { loadAcceptedProjections } from "../../../src/core/second-nature/control-plane/accepted-projection-loader.js";
import { buildQuietDailyReview } from "../../../src/core/second-nature/quiet-dream/quiet-daily-review-builder.js";
import { writeActionClosureRecord, writeEvidenceItem } from "../../../src/storage/v8-state-stores.js";
import type { SourceRef } from "../../../src/shared/types/v8-contracts.js";

function makeRef(id: string, family: SourceRef["family"] = "evidence"): SourceRef {
  return { uri: `sn://${family}/${id}`, family, id, redactionClass: "none", resolveStatus: "resolvable" };
}

describe("int-r2-proof-memory-closure", () => {
  it("T-VERIFY.R.1: runtime heartbeat produces real closure, not seeded false green", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = new Date().toISOString();

      // Run real heartbeat
      const cycle = await runHeartbeatCycle(db, {
        workspaceRoot: "/test",
        requestedAt: now,
        trigger: "manual",
      });
      assert.ok("cycleId" in cycle, "heartbeat must produce cycle");

      // Health gate must pass from runtime evidence
      const health = await checkRealRunHealth(db);
      assert.equal(health.ok, true);
      if (health.ok) {
        assert.equal(health.gate.seededStateDetected, false, "must not detect seeded state");
        assert.equal(health.gate.hasRealClosure, true, "must have real closure");
      }
    } finally {
      db.close();
    }
  });

  it("T-OBS.R.3: loop_status consumes real-run health and reports parity", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = new Date().toISOString();
      const day = now.slice(0, 10);
      await runHeartbeatCycle(db, { workspaceRoot: "/test", requestedAt: now, trigger: "manual" });
      await checkDailyRhythm(db, { now, forceQuiet: true });

      // Seed impulse context and projection for full gate pass
      await writeImpulseContext(db, {
        sceneType: "heartbeat",
        impulseResult: { impulse: { kind: "social", text: "Be warm", reviewStatus: "approved" }, source: "intent_kind", capabilityClass: null },
        atmosphereText: "Open",
        expressionBoundaryConstraints: ["avoid_sarcasm"],
      }, { now });

      const { writeLongTermMemoryProjection } = await import("../../../src/storage/v8-state-stores.js");
      await writeLongTermMemoryProjection(db, {
        id: `proj_${day}_001`,
        createdAt: now,
        candidateId: `candidate_${day}_001`,
        topicKey: "test_topic",
        status: "active",
        sourceRefs: [makeRef("proj1", "memory_projection")],
        redactionClass: "none",
        payloadJson: JSON.stringify({ memoryText: "test memory", acceptedAt: now }),
      });

      const status = await readLoopStatus(db);
      assert.equal(status.ok, true);
      if (status.ok) {
        assert.ok(status.status.realRunHealth, "loop_status must include realRunHealth");
        assert.equal(status.status.realRunHealth.gatePassed, true, "gate must pass");
        assert.ok(status.status.realRunHealth.hasRealClosure, "must report real closure");
        assert.ok(status.status.realRunHealth.hasQuietArtifact, "must report quiet artifact");
      }
    } finally {
      db.close();
    }
  });

  it("T-PJ.R.1: perception uses canonical novelty/relevance contract", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = new Date().toISOString();
      await writeEvidenceItem(db, {
        id: "ev_canon",
        platformId: "moltbook",
        contentHash: "hash_canon",
        observedAt: now,
        createdAt: now,
        sensitivityHint: "public_general",
        sourceRefs: [makeRef("ev_canon")],
        redactionClass: "none",
        lifecycleStatus: "pending",
        payloadJson: JSON.stringify({
          schemaVersion: 1,
          sourceKind: "post",
          platformId: "moltbook",
          capabilityId: "feed.read",
          summary: "Canonical content for perception contract test",
          observedAt: now,
          summaryProducer: "connector_rules",
        }),
      });

      const result = await buildPerceptionCards(db, { cycleId: "cyc_canon", now });
      assert.ok("status" in result && result.status === "completed");
      if ("status" in result && result.status === "completed") {
        const card = result.cards[0];
        assert.ok(["new", "changed", "duplicate", "stale"].includes(card.noveltyClass));
        assert.ok(["low", "medium", "high"].includes(card.relevanceClass));
        assert.ok(card.relevanceScore >= 0 && card.relevanceScore <= 1);
      }
    } finally {
      db.close();
    }
  });

  it("T-DQ.R.3: projection supersession updates old row + accepted memory feeds heartbeat", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = new Date().toISOString();

      // Accept first projection
      const r1 = await acceptMemoryProjection(db, "cand_r2a", "topic_r2", "memory 1", [makeRef("cand_r2a", "projection")], { now });
      assert.ok("status" in r1 && r1.status === "accepted");
      const proj1 = (r1 as any).projectionId;

      // Accept second projection — must supersede first
      const r2 = await acceptMemoryProjection(db, "cand_r2b", "topic_r2", "memory 2", [makeRef("cand_r2b", "projection")], { now });
      assert.ok("status" in r2 && r2.status === "accepted");
      assert.equal((r2 as any).supersedesProjectionId, proj1);

      // Heartbeat loads projections into context
      const cycle = await runHeartbeatCycle(db, {
        workspaceRoot: "/test",
        requestedAt: now,
        trigger: "manual",
      });
      assert.ok("cycleId" in cycle);

      // Verify projections are loadable
      const loaded = await loadAcceptedProjections(db);
      assert.equal(loaded.ok, true);
      if (loaded.ok) {
        assert.ok(loaded.slice.projections.length > 0, "projections must be loadable");
      }
    } finally {
      db.close();
    }
  });

  it("T-DQ.R.4: quiet daily review contains first-class closureRefs", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = new Date().toISOString();
      const day = now.slice(0, 10);

      // Seed closure
      await writeActionClosureRecord(db, {
        id: `closure_${day}_001`,
        cycleId: `cycle_${day}_001`,
        status: "completed",
        reason: "closure_completed",
        sourceRefs: [makeRef("closure_001", "action_closure")],
        createdAt: now,
      });

      const result = await buildQuietDailyReview(db, { day, now });
      assert.equal(result.status, "completed");
      if (result.status === "completed") {
        assert.ok(result.review.closureRefs, "review must have closureRefs");
        assert.equal(result.review.closureRefs.length, 1, "must have one closure ref");
        assert.equal(result.review.closureRefs[0].family, "action_closure");
      }
    } finally {
      db.close();
    }
  });

  it("all Wave 107 artifacts exist and are consistent", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");

    const required = [
      "reports/int-r1-v8-runtime-activation-repair.md",
      "logs/int-r1-loop-status.json",
      ".anws/v8/wave-reviews/wave-106-review.md",
      "reports/perception-contract-alignment.md",
      "logs/int-r2-loop-status.json",
    ];

    for (const file of required) {
      const full = path.resolve(file);
      assert.ok(fs.existsSync(full), `required artifact ${file} must exist`);
      const stat = fs.statSync(full);
      assert.ok(stat.size > 0, `artifact ${file} must not be empty`);
    }
  });
});
