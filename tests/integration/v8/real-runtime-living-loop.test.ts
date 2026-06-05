/**
 * Real Runtime Living Loop — Integration Test (T-CP.R.2 / INT-R1 prep)
 *
 * Validates: real workspace heartbeat advances evidence → perception → judgment
 * → policy → dispatch → closure with state-backed persistence. No contract-only
 * smoke passes as runtime proof.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import {
  writeEvidenceItem,
  writePerceptionCard,
  readActionClosuresByCycle,
  readLoopStageEventsByCycle,
  readHeartbeatCycleTraces,
} from "../../../src/storage/v8-state-stores.js";
import { runHeartbeatCycle } from "../../../src/core/second-nature/control-plane/heartbeat-orchestrator.js";
import type { SourceRef } from "../../../src/shared/types/v8-contracts.js";

function makeRef(id: string, family: import("../../../src/shared/types/v8-contracts.js").SourceRefFamily = "evidence"): SourceRef {
  return {
    uri: `sn://${family}/${id}`,
    family,
    id,
    redactionClass: "none",
    resolveStatus: "resolvable",
  };
}

describe("real-runtime-living-loop", () => {
  it("full cycle: evidence → perception → judgment → closure", async () => {
    const db = createStateDatabase(":memory:");
    try {
      // Step 1: Seed evidence
      await writeEvidenceItem(db, {
        id: "ev_real_001",
        createdAt: new Date().toISOString(),
        platformId: "moltbook",
        contentHash: "hash001",
        observedAt: new Date().toISOString(),
        sourceRefs: [makeRef("ev_real_001")],
        redactionClass: "none",
        lifecycleStatus: "pending",
      });

      // Step 2: Run heartbeat cycle
      const result = await runHeartbeatCycle(db, {
        workspaceRoot: "/test",
        requestedAt: new Date().toISOString(),
        trigger: "manual",
      });

      const r = result as { cycleId: string; cycleSequence: number };

      // Step 3: Verify cycle trace persisted
      const traces = await readHeartbeatCycleTraces(db, 10);
      assert.ok(
        traces.rows.some((t) => t.id === r.cycleId),
        "cycle trace should be persisted"
      );

      // Step 4: Verify closure record exists
      const closures = await readActionClosuresByCycle(db, r.cycleId);
      assert.equal(
        closures.rows.length,
        1,
        "exactly one closure record per cycle"
      );

      // Step 5: Verify stage events cover all stages
      const events = await readLoopStageEventsByCycle(db, r.cycleId);
      const stages = new Set(events.rows.map((e) => e.stage));
      assert.ok(stages.has("ingestion"), "ingestion stage");
      assert.ok(stages.has("perception"), "perception stage");
      assert.ok(stages.has("judgment"), "judgment stage");
      assert.ok(stages.has("policy"), "policy stage");
      assert.ok(stages.has("closure"), "closure stage");

      // Step 6: No duplicate closures
      assert.equal(
        closures.rows.filter((c) => c.cycleId === r.cycleId).length,
        1,
        "no duplicate closure for same cycle"
      );
    } finally {
      db.close();
    }
  });

  it("closure status is observable in loop_status diagnostics", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const result = await runHeartbeatCycle(db, {
        workspaceRoot: "/test",
        requestedAt: new Date().toISOString(),
        trigger: "scheduled",
      });

      const r = result as { cycleId: string };
      const closures = await readActionClosuresByCycle(db, r.cycleId);
      const closure = closures.rows[0];
      assert.ok(closure, "closure exists");
      assert.ok(
        ["no_action", "completed", "denied", "deferred", "downgraded", "failed"].includes(
          closure.status
        ),
        `closure status '${closure.status}' is canonical`
      );
    } finally {
      db.close();
    }
  });
});
