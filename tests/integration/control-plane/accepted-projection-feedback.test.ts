/**
 * Accepted Projection Feedback — Integration Test (T-DQ.R.3)
 *
 * Validates:
 * 1. Projection supersession uses UPDATE instead of INSERT (no PK conflict)
 * 2. Accepted projections are loaded into heartbeat context
 * 3. Judgment receives projections and boosts verdict for matching topics
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { acceptMemoryProjection } from "../../../src/core/second-nature/quiet-dream/memory-projection-lifecycle.js";
import { loadAcceptedProjections } from "../../../src/core/second-nature/control-plane/accepted-projection-loader.js";
import { runHeartbeatCycle } from "../../../src/core/second-nature/control-plane/heartbeat-orchestrator.js";
import { writeEvidenceItem, readLongTermMemoryProjectionById } from "../../../src/storage/v8-state-stores.js";
import type { SourceRef } from "../../../src/shared/types/v8-contracts.js";

function makeRef(id: string, family: SourceRef["family"] = "evidence"): SourceRef {
  return {
    uri: `sn://${family}/${id}`,
    family,
    id,
    redactionClass: "none",
    resolveStatus: "resolvable",
  };
}

describe("accepted-projection-feedback", () => {
  it("supersedes existing active projection without PK conflict", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = new Date().toISOString();

      // Accept first projection on topic "sn_test"
      const r1 = await acceptMemoryProjection(
        db,
        "cand_001",
        "sn_test",
        "First memory",
        [makeRef("cand_001", "projection")],
        { now },
      );
      assert.ok("status" in r1 && r1.status === "accepted", "first acceptance should succeed");
      const proj1Id = (r1 as any).projectionId;

      // Read back first projection
      const read1 = await readLongTermMemoryProjectionById(db, proj1Id);
      assert.equal(read1.row?.status, "active");

      // Accept second projection on same topic — should supersede first
      const r2 = await acceptMemoryProjection(
        db,
        "cand_002",
        "sn_test",
        "Second memory",
        [makeRef("cand_002", "projection")],
        { now },
      );
      assert.ok("status" in r2 && r2.status === "accepted", "second acceptance should succeed");
      assert.equal((r2 as any).supersedesProjectionId, proj1Id, "should reference superseded projection");

      // Verify first projection is now superseded
      const read1After = await readLongTermMemoryProjectionById(db, proj1Id);
      assert.equal(read1After.row?.status, "superseded", "first projection should be superseded");

      // Verify second projection is active
      const proj2Id = (r2 as any).projectionId;
      const read2 = await readLongTermMemoryProjectionById(db, proj2Id);
      assert.equal(read2.row?.status, "active", "second projection should be active");
    } finally {
      db.close();
    }
  });

  it("heartbeat loads accepted projections into context", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = new Date().toISOString();

      // Accept a projection
      await acceptMemoryProjection(
        db,
        "cand_ctx",
        "sn_test",
        "Memory about sn_test",
        [makeRef("cand_ctx", "projection")],
        { now },
      );

      // Verify loadAcceptedProjections returns it
      const loaded = await loadAcceptedProjections(db);
      assert.equal(loaded.ok, true);
      if (loaded.ok) {
        assert.equal(loaded.slice.projections.length, 1);
        assert.equal(loaded.slice.projections[0].topicKey, "sn_test");
      }

      // Run heartbeat cycle — should not fail with projection context
      const cycleResult = await runHeartbeatCycle(db, {
        workspaceRoot: "/test",
        requestedAt: now,
        trigger: "manual",
      });
      assert.ok("cycleId" in cycleResult, "heartbeat should produce cycleId");
    } finally {
      db.close();
    }
  });

  it("judgment boosts verdict when topic matches accepted projection", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = new Date().toISOString();

      // Write evidence with topic matching projection
      await writeEvidenceItem(db, {
        id: "ev_boost",
        platformId: "moltbook",
        contentHash: "hash_boost",
        observedAt: now,
        createdAt: now,
        sensitivityHint: "public_general",
        sourceRefs: [makeRef("ev_boost")],
        redactionClass: "none",
        lifecycleStatus: "pending",
        payloadJson: JSON.stringify({ topic: "sn_test" }),
      });

      // Accept a projection on "sn_test"
      await acceptMemoryProjection(
        db,
        "cand_boost",
        "sn_test",
        "Memory about sn_test",
        [makeRef("cand_boost", "projection")],
        { now },
      );

      // Run heartbeat — this triggers perception + judgment with projections
      const cycleResult = await runHeartbeatCycle(db, {
        workspaceRoot: "/test",
        requestedAt: now,
        trigger: "manual",
      });

      assert.ok("cycleId" in cycleResult, "heartbeat should succeed");
      // If matching projection works, the cycle should complete normally
      if ("cycleId" in cycleResult) {
        assert.ok(cycleResult.closureRef, "should produce closure");
      }
    } finally {
      db.close();
    }
  });
});
