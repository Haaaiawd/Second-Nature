/**
 * RealRuntimeSpine — Unit Tests (T-CP.R.2)
 *
 * Validates: real workspace heartbeat produces exactly one closure/no-action
 * per cycle, stage event ordering, degraded diagnostics, and no real external writes.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import {
  writeEvidenceItem,
  writePerceptionCard,
  writeJudgmentVerdict,
  readActionClosuresByCycle,
  readLoopStageEventsByCycle,
} from "../../../src/storage/v8-state-stores.js";
import { runHeartbeatCycle } from "../../../src/core/second-nature/control-plane/heartbeat-orchestrator.js";
import type { SourceRef } from "../../../src/shared/types/v8-contracts.js";

function makeRef(overrides?: Partial<SourceRef>): SourceRef {
  return {
    uri: "sn://test/ev_001",
    family: "evidence",
    id: "ev_001",
    redactionClass: "none",
    resolveStatus: "resolvable",
    ...overrides,
  };
}

async function seedEvidence(db: ReturnType<typeof createStateDatabase>, cycleId: string) {
  await writeEvidenceItem(db, {
    id: `ev_${cycleId}`,
    createdAt: new Date().toISOString(),
    platformId: "moltbook",
    contentHash: "abc123",
    observedAt: new Date().toISOString(),
    sourceRefs: [makeRef({ id: `ev_${cycleId}` })],
    redactionClass: "none",
    lifecycleStatus: "pending",
  });
}

async function seedPerception(db: ReturnType<typeof createStateDatabase>, cycleId: string) {
  await writePerceptionCard(db, {
    id: `perc_${cycleId}`,
    createdAt: new Date().toISOString(),
    cycleId,
    topic: "feed_read",
    entitiesJson: JSON.stringify(["item1"]),
    novelty: "new",
    relevance: 0.8,
    summary: "Test perception",
    riskFlagsJson: JSON.stringify([]),
    confidence: 0.75,
    reviewPriority: "normal",
    sourceRefs: [makeRef({ id: `perc_${cycleId}`, family: "perception" })],
    redactionClass: "none",
    payloadJson: JSON.stringify({
      possibleIntents: ["watch", "draft_reply"],
      sensitivityClass: "public_technical",
    }),
    lifecycleStatus: "pending",
  });
}

describe("real-runtime-spine", () => {
  it("produces no-action closure when no evidence exists", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const result = await runHeartbeatCycle(db, {
        workspaceRoot: "/test",
        requestedAt: new Date().toISOString(),
        trigger: "scheduled",
      });

      assert.ok("cycleId" in result, "should return cycle result");
      const r = result as { cycleId: string; noActionReason?: string };
      assert.ok(r.noActionReason, "should have no-action reason when empty");

      const closures = await readActionClosuresByCycle(db, r.cycleId);
      assert.equal(closures.rows.length, 1, "exactly one closure per cycle");
    } finally {
      db.close();
    }
  });

  it("produces closure record after perception + judgment + policy + dispatch", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const cycleResult = await runHeartbeatCycle(db, {
        workspaceRoot: "/test",
        requestedAt: new Date().toISOString(),
        trigger: "scheduled",
      });

      // Seed evidence for the cycle
      const cycleId = (cycleResult as { cycleId: string }).cycleId;
      await seedEvidence(db, cycleId);
      await seedPerception(db, cycleId);

      // Run a second cycle that will pick up the seeded evidence
      const result2 = await runHeartbeatCycle(db, {
        workspaceRoot: "/test",
        requestedAt: new Date().toISOString(),
        trigger: "scheduled",
      });

      const r2 = result2 as { cycleId: string; closureRef?: { id: string } };
      const closures = await readActionClosuresByCycle(db, r2.cycleId);
      assert.equal(closures.rows.length, 1, "exactly one closure per cycle");

      // Verify stage events exist
      const events = await readLoopStageEventsByCycle(db, r2.cycleId);
      const stages = events.rows.map((e) => e.stage);
      assert.ok(stages.includes("ingestion"), "ingestion stage event");
      assert.ok(stages.includes("perception"), "perception stage event");
      assert.ok(stages.includes("judgment"), "judgment stage event");
      assert.ok(stages.includes("policy"), "policy stage event");
      assert.ok(stages.includes("closure"), "closure stage event");
    } finally {
      db.close();
    }
  });

  it("does not perform real external writes — connector dispatch is simulated", async () => {
    const db = createStateDatabase(":memory:");
    try {
      // Seed evidence with public_technical hint to trigger actionable intents
      await writeEvidenceItem(db, {
        id: "ev_ext",
        createdAt: new Date().toISOString(),
        platformId: "moltbook",
        contentHash: "ext123",
        observedAt: new Date().toISOString(),
        sourceRefs: [makeRef({ id: "ev_ext" })],
        redactionClass: "none",
        lifecycleStatus: "pending",
      });

      const result = await runHeartbeatCycle(db, {
        workspaceRoot: "/test",
        requestedAt: new Date().toISOString(),
        trigger: "scheduled",
      });

      const r = result as { cycleId: string };
      const closures = await readActionClosuresByCycle(db, r.cycleId);
      assert.equal(closures.rows.length, 1, "exactly one closure");

      const closure = closures.rows[0];
      assert.ok(closure, "closure exists");
      // No real platform write occurred; status must be non-executed
      const nonExecutedStatuses = ["no_action", "denied", "deferred", "downgraded", "failed"];
      assert.ok(
        nonExecutedStatuses.includes(closure.status),
        `closure status '${closure.status}' records simulated/non-executed outcome`
      );
    } finally {
      db.close();
    }
  });

  it("emits canonical stage events on degraded path", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const result = await runHeartbeatCycle(db, {
        workspaceRoot: "/test",
        requestedAt: new Date().toISOString(),
        trigger: "scheduled",
      });

      const r = result as { cycleId: string };
      const events = await readLoopStageEventsByCycle(db, r.cycleId);
      assert.ok(events.rows.length >= 2, "at least ingestion + closure events on degraded");

      const closureEvent = events.rows.find((e) => e.stage === "closure");
      assert.ok(closureEvent, "closure stage event exists even on degraded path");
    } finally {
      db.close();
    }
  });
});
