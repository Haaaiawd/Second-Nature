/**
 * Perception Contract Alignment — Unit Tests (T-PJ.R.1)
 *
 * Validates: PerceptionCard uses canonical novelty/relevance shape.
 * - noveltyClass: new | changed | duplicate | stale
 * - relevanceScore: number in [0, 1]
 * - relevanceClass: low | medium | high
 *
 * Legacy fields (recurring, update, numeric-only relevance without class)
 * are not persisted by new writes.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { writeEvidenceItem, readPerceptionCardById } from "../../../src/storage/v8-state-stores.js";
import { buildPerceptionCards } from "../../../src/core/second-nature/perception/perception-builder.js";
import type { SourceRef } from "../../../src/shared/types/v8-contracts.js";

function makeRef(id: string): SourceRef {
  return {
    uri: `sn://evidence/${id}`,
    family: "evidence",
    id,
    redactionClass: "none",
    resolveStatus: "resolvable",
  };
}

describe("perception-contract-alignment", () => {
  it("writes canonical novelty class", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = new Date().toISOString();
      await writeEvidenceItem(db, {
        id: "ev_001",
        platformId: "moltbook",
        contentHash: "hash001",
        observedAt: now,
        createdAt: now,
        sensitivityHint: "public_general",
        sourceRefs: [makeRef("ev_001")],
        redactionClass: "none",
        lifecycleStatus: "pending",
      });

      const result = await buildPerceptionCards(db, { cycleId: "cyc_001", now });
      assert.ok(result);
      if ("status" in result && result.status === "completed") {
        assert.equal(result.cards.length, 1);
        const card = result.cards[0];
        assert.ok(
          ["new", "changed", "duplicate", "stale"].includes(card.noveltyClass),
          `noveltyClass '${card.noveltyClass}' must be canonical`
        );
        assert.ok(
          !["recurring", "update"].includes(card.noveltyClass),
          `noveltyClass must not use legacy values`
        );
      }
    } finally {
      db.close();
    }
  });

  it("writes canonical relevance score and class", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = new Date().toISOString();
      await writeEvidenceItem(db, {
        id: "ev_sens",
        platformId: "moltbook",
        contentHash: "hash_sens",
        observedAt: now,
        createdAt: now,
        sensitivityHint:"sensitive",
        sourceRefs: [makeRef("ev_sens")],
        redactionClass: "none",
        lifecycleStatus: "pending",
      });

      const result = await buildPerceptionCards(db, { cycleId: "cyc_002", now });
      assert.ok(result);
      if ("status" in result && result.status === "completed") {
        const card = result.cards[0];
        assert.ok(
          typeof card.relevanceScore === "number" && card.relevanceScore >= 0 && card.relevanceScore <= 1,
          "relevanceScore must be a number in [0, 1]"
        );
        assert.ok(
          ["low", "medium", "high"].includes(card.relevanceClass),
          `relevanceClass '${card.relevanceClass}' must be canonical`
        );
      }
    } finally {
      db.close();
    }
  });

  it("persisted card round-trips with canonical fields", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = new Date().toISOString();
      await writeEvidenceItem(db, {
        id: "ev_rt",
        platformId: "moltbook",
        contentHash: "hash_rt",
        observedAt: now,
        createdAt: now,
        sensitivityHint:"public_technical",
        sourceRefs: [makeRef("ev_rt")],
        redactionClass: "none",
        lifecycleStatus: "pending",
      });

      const buildResult = await buildPerceptionCards(db, { cycleId: "cyc_rt", now });
      assert.ok(buildResult);
      if ("status" in buildResult && buildResult.status === "completed") {
        const cardId = buildResult.cards[0].id;
        const readResult = await readPerceptionCardById(db, cardId);
        assert.ok(readResult.row);
        const row = readResult.row!;
        assert.ok(
          ["new", "changed", "duplicate", "stale"].includes(row.novelty ?? ""),
          `persisted novelty '${row.novelty}' must be canonical`
        );
        assert.ok(
          typeof row.relevance === "number",
          "persisted relevance must be a number (score)"
        );
        assert.ok(
          ["low", "medium", "high"].includes(row.relevanceClass ?? ""),
          `persisted relevanceClass '${row.relevanceClass}' must be canonical`
        );
      }
    } finally {
      db.close();
    }
  });

  it("relevance class mapping is consistent with score", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = new Date().toISOString();
      // public_technical → score 0.7 → class "high"
      await writeEvidenceItem(db, {
        id: "ev_high",
        platformId: "moltbook",
        contentHash: "hash_high",
        observedAt: now,
        createdAt: now,
        sensitivityHint:"public_technical",
        sourceRefs: [makeRef("ev_high")],
        redactionClass: "none",
        lifecycleStatus: "pending",
      });
      // private_context → score 0.5 → class "medium"
      await writeEvidenceItem(db, {
        id: "ev_med",
        platformId: "moltbook",
        contentHash: "hash_med",
        observedAt: now,
        createdAt: now,
        sensitivityHint:"private_context",
        sourceRefs: [makeRef("ev_med")],
        redactionClass: "none",
        lifecycleStatus: "pending",
      });
      // public_general → score 0.3 → class "low"
      await writeEvidenceItem(db, {
        id: "ev_low",
        platformId: "moltbook",
        contentHash: "hash_low",
        observedAt: now,
        createdAt: now,
        sensitivityHint:"public_general",
        sourceRefs: [makeRef("ev_low")],
        redactionClass: "none",
        lifecycleStatus: "pending",
      });

      const result = await buildPerceptionCards(db, { cycleId: "cyc_map", now });
      assert.ok(result);
      if ("status" in result && result.status === "completed") {
        const byId = new Map(result.cards.map((c) => [c.id, c]));
        assert.equal(byId.get("per_ev_high")?.relevanceScore, 0.7);
        assert.equal(byId.get("per_ev_high")?.relevanceClass, "high");
        assert.equal(byId.get("per_ev_med")?.relevanceScore, 0.5);
        assert.equal(byId.get("per_ev_med")?.relevanceClass, "medium");
        assert.equal(byId.get("per_ev_low")?.relevanceScore, 0.3);
        assert.equal(byId.get("per_ev_low")?.relevanceClass, "low");
      }
    } finally {
      db.close();
    }
  });
});
