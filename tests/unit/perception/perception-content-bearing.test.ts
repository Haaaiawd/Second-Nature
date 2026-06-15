/**
 * Content-bearing Perception tests (T-PJ.R.2)
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import {
  writeEvidenceItem,
  readEvidenceItemById,
  readPerceptionCardsByCycle,
} from "../../../src/storage/v8-state-stores.js";
import { buildPerceptionCards } from "../../../src/core/second-nature/perception/perception-builder.js";
import type { SourceRef } from "../../../src/shared/types/v8-contracts.js";

function makeRef(id: string): SourceRef {
  return { uri: `sn://evidence/${id}`, family: "evidence", id, redactionClass: "none", resolveStatus: "resolvable" };
}

describe("perception content-bearing", () => {
  it("produces readable summary from evidence payload and advances lifecycle", async () => {
    const db = createStateDatabase(":memory:");
    try {
      await writeEvidenceItem(db, {
        id: "ev_cb_001",
        createdAt: "2026-06-15T10:00:00Z",
        platformId: "moltbook",
        contentHash: "cb_hash_001",
        observedAt: "2026-06-15T10:00:00Z",
        sourceRefs: [makeRef("ev_cb_001")],
        redactionClass: "none",
        lifecycleStatus: "pending",
        payloadJson: JSON.stringify({
          schemaVersion: 1,
          sourceKind: "post",
          platformId: "moltbook",
          capabilityId: "feed.read",
          externalId: "post_001",
          observedAt: "2026-06-15T10:00:00Z",
          summaryProducer: "connector_rules",
          title: "Team standup notes",
          summary: "Discussed roadmap priorities and agreed on Q3 focus.",
          entities: ["memory", "roadmap"],
        }),
      });

      const result = await buildPerceptionCards(db, {
        cycleId: "cyc_001",
        now: "2026-06-15T10:05:00Z",
      });

      assert.ok("cards" in result, "returns cards");
      assert.equal(result.cards.length, 1);
      assert.equal(result.cards[0]?.summary, "Discussed roadmap priorities and agreed on Q3 focus.");
      assert.ok(!result.cards[0]?.contentMissing);

      const evidenceAfter = await readEvidenceItemById(db, "ev_cb_001");
      assert.ok("row" in evidenceAfter, "evidence read ok");
      assert.equal(evidenceAfter.row?.lifecycleStatus, "perceived");

      const cards = await readPerceptionCardsByCycle(db, "cyc_001");
      assert.equal(cards.rows.length, 1);
    } finally {
      db.close();
    }
  });

  it("marks ref-only evidence as contentMissing and keeps lifecycle pending", async () => {
    const db = createStateDatabase(":memory:");
    try {
      await writeEvidenceItem(db, {
        id: "ev_ref_001",
        createdAt: "2026-06-15T10:00:00Z",
        platformId: "moltbook",
        contentHash: "ref_hash_001",
        observedAt: "2026-06-15T10:00:00Z",
        sourceRefs: [makeRef("ev_ref_001")],
        redactionClass: "none",
        lifecycleStatus: "pending",
        payloadJson: JSON.stringify({ schemaVersion: 1, sourceKind: "post" }),
      });

      const result = await buildPerceptionCards(db, {
        cycleId: "cyc_002",
        now: "2026-06-15T10:05:00Z",
      });

      assert.ok("cards" in result, "returns cards");
      assert.equal(result.cards.length, 1);
      assert.equal(result.cards[0]?.contentMissing, true);
      assert.equal(result.status, "rules_only");

      const evidenceAfter = await readEvidenceItemById(db, "ev_ref_001");
      assert.ok("row" in evidenceAfter, "evidence read ok");
      assert.equal(evidenceAfter.row?.lifecycleStatus, "perceived");
    } finally {
      db.close();
    }
  });
});
