/**
 * QuietDailyReview content-bearing tests (T-DQ.R.6)
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import {
  writeEvidenceItem,
  writePerceptionCard,
  writeActionClosureRecord,
} from "../../../src/storage/v8-state-stores.js";
import { buildQuietDailyReview } from "../../../src/core/second-nature/quiet-dream/quiet-daily-review-builder.js";
import type { SourceRef } from "../../../src/shared/types/v8-contracts.js";

function makeRef(id: string, family: SourceRef["family"] = "evidence"): SourceRef {
  return { uri: `sn://${family}/${id}`, family, id, redactionClass: "none", resolveStatus: "resolvable" };
}

describe("quiet-daily-review content", () => {
  it("loads evidence and perception rows for the day", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const day = "2026-06-15";

      await writeActionClosureRecord(db, {
        id: `closure_${day}_1`,
        createdAt: `${day}T12:00:00Z`,
        cycleId: "cyc_001",
        status: "completed",
        sourceRefs: [makeRef(`closure_${day}_1`, "action_closure")],
        redactionClass: "none",
        lifecycleStatus: "closed",
      });

      await writeEvidenceItem(db, {
        id: "ev_q_001",
        createdAt: `${day}T10:00:00Z`,
        platformId: "moltbook",
        contentHash: "q_hash_001",
        observedAt: `${day}T10:00:00Z`,
        sourceRefs: [makeRef("ev_q_001")],
        redactionClass: "none",
        lifecycleStatus: "perceived",
        payloadJson: JSON.stringify({
          schemaVersion: 1,
          sourceKind: "post",
          platformId: "moltbook",
          title: "Standup notes",
          summary: "Roadmap priorities for memory loop.",
        }),
      });

      await writePerceptionCard(db, {
        id: "per_q_001",
        createdAt: `${day}T11:00:00Z`,
        cycleId: "cyc_001",
        topic: "memory loop",
        summary: "Roadmap priorities for memory loop.",
        sourceRefs: [makeRef("per_q_001", "perception")],
        redactionClass: "none",
        lifecycleStatus: "pending",
      });

      const result = await buildQuietDailyReview(db, { day, now: `${day}T14:00:00Z` });
      assert.equal(result.status, "completed");
      if (result.status !== "completed") return;

      assert.ok(result.review.reviewSummary, "reviewSummary exists");
      assert.ok(result.review.sections, "sections exist");
      assert.ok(
        result.review.sections.some((s: { title: string }) => s.title === "Notable signals"),
        "has notable signals section",
      );
      assert.ok(
        result.review.sections.some((s: { lines: string[] }) =>
          s.lines.some((l: string) => l.includes("Roadmap priorities")),
        ),
        "notable signals include perception/evidence content",
      );
      assert.ok(!result.review.reviewSummary.includes("Source-backed quiet summary"), "no banned template");
    } finally {
      db.close();
    }
  });
});
