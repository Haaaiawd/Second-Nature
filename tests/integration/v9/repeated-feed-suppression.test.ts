/**
 * v9 Repeated Feed Suppression integration test (T3.2.2).
 *
 * Verifies that running the same MoltBook feed fixture three times produces
 * exactly one logical evidence row with seenCount=3, and the attention signal
 * is marked as duplicate with novelty=0.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { createStateDatabase } from "../../../src/storage/db/index.js";
import { readEvidenceItemsByStatus } from "../../../src/storage/v8-state-stores.js";
import { createEvidenceIdentityPort } from "../../../src/storage/v9-evidence-identity-port.js";
import { normalizeConnectorEvidence } from "../../../src/connectors/evidence-normalizer.js";
import { assembleAttention } from "../../../src/core/second-nature/perception/attention-assembler.js";

describe("v9 repeated feed suppression", () => {
  it("keeps one logical row and increments seenCount across three runs", async () => {
    const db = createStateDatabase(":memory:");
    try {
      for (let i = 0; i < 3; i++) {
        await normalizeConnectorEvidence(db, {
          status: "success",
          platformId: "moltbook",
          capabilityId: "feed.read",
          data: { posts: [{ id: "post-1", title: "A", content: "content A" }] },
          observedAt: `2026-06-20T10:0${i}:00Z`,
        });
      }

      const pending = await readEvidenceItemsByStatus(db, "pending");
      assert.equal(pending.rows.length, 1, "expected exactly one logical evidence row");
      const row = pending.rows[0]!;
      assert.equal(row.seenCount, 3, "expected seenCount to reach 3");
      assert.equal(row.stableIdentityKey, "post-1");
      assert.equal(row.rowIdentityStatus, "stable");

      const port = createEvidenceIdentityPort(db);
      const evidenceId = row.id;
      const { signal } = await assembleAttention(
        {
          evidence: {
            id: evidenceId,
            platformId: "moltbook",
            capabilityId: "feed.read",
            externalId: "post-1",
            observedAt: "2026-06-20T10:02:00Z",
            content: "content A",
            summary: "content A",
            sensitivityHint: "public_general",
            sourceRefs: [{ family: "evidence", id: evidenceId }],
          },
          context: {
            acceptedGoals: [],
            activeProjections: [],
            bodyIntuition: { recentPlatforms: [] },
            routineRegistry: [],
            activeActivityThreads: [],
            cycleSequence: 1,
          },
        },
        {
          identityPort: port,
          cycleId: "cycle-1",
          cycleSequence: 1,
          db,
          now: "2026-06-20T10:02:00Z",
        },
      );

      assert.equal(signal.repetition, "duplicate");
      assert.equal(signal.novelty, 0);
      assert.equal(signal.status, "attentive");
    } finally {
      db.close();
    }
  });
});
