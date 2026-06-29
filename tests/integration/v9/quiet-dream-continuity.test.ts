/**
 * v9 Quiet→Dream Continuity Integration — T5.2.1
 *
 * Validates: v9 Dream consolidation runner routes output families
 * and accepts procedural projection candidates into v9 state stores.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { writeQuietDailyReview, writeDreamConsolidationRun } from "../../../src/storage/v8-state-stores.js";
import {
  writeProceduralProjection,
  readProceduralProjectionsByCapabilityPattern,
} from "../../../src/storage/v9-state-stores.js";
import { runV9DreamConsolidation } from "../../../src/core/second-nature/quiet-dream/v9-dream-consolidation-runner.js";
import { acceptProceduralProjection } from "../../../src/core/second-nature/quiet-dream/v9-procedural-projection-lifecycle.js";

const seedReviewPayload = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    contentStatus: "content_present",
    reviewSummary: "daily activity summary",
    importanceSignals: ["signal-a", "signal-b"],
    routineSignals: [{ capabilityPattern: "github:issue.search", summary: "searched issues" }],
    continuitySignals: ["owner replied quickly"],
    connectorEvolutionSignals: [{ platformId: "github", planType: "manifest_delta", summary: "added issue search" }],
    characterSignals: ["prefers concise updates"],
    ...overrides,
  });

test("T5.2.1 v9 Dream runner emits all output families", async () => {
  const db = createStateDatabase(":memory:");
  try {
    const reviewWrite = await writeQuietDailyReview(db, {
      id: "review_t521_001",
      day: "2026-06-26",
      sourceRefs: [{ uri: "sn://evidence/ev1", family: "evidence", id: "ev1", redactionClass: "none", resolveStatus: "resolvable" }],
      payloadJson: seedReviewPayload(),
      createdAt: "2026-06-26T00:00:00Z",
    });
    if ("ownerStage" in reviewWrite) throw new Error("review write failed");
    const reviewId = reviewWrite.id;

    const runWrite = await writeDreamConsolidationRun(db, {
      id: "run_t521_001",
      quietReviewId: reviewId,
      status: "started",
      sourceRefs: [{ uri: "sn://quiet/review_t521_001", family: "quiet_review", id: reviewId, redactionClass: "none", resolveStatus: "resolvable" }],
      createdAt: "2026-06-26T01:00:00Z",
    });
    if ("ownerStage" in runWrite) throw new Error("run write failed");
    const runId = runWrite.id;

    const result = await runV9DreamConsolidation(db, runId);
    assert.equal(result.status, "completed");
    const families = (result as any).outputFamilies as string[];
    assert.ok(families.includes("memory"));
    assert.ok(families.includes("procedural"));
    assert.ok(families.includes("self_continuity"));
    assert.ok(families.includes("connector_evolution"));
    assert.ok(families.includes("character"));

    const candidates = (result as any).candidates as Array<{ family: string; validationStatus: string }>;
    assert.ok(candidates.some((c) => c.family === "procedural" && c.validationStatus === "valid"));
  } finally {
    db.close();
  }
});

test("T5.2.1 v9 procedural projection accept persists and supersedes", async () => {
  const db = createStateDatabase(":memory:");
  try {
    await writeProceduralProjection(db, {
      id: "proc_old_001",
      createdAt: "2026-06-25T00:00:00Z",
      candidateId: "cand_old",
      capabilityPattern: "github:issue.search",
      status: "installed",
      sourceRefs: [{ family: "quiet", id: "review_old" }],
    });

    const result = await acceptProceduralProjection(
      db,
      "cand_new_001",
      "github:issue.search",
      "searched issues",
      [{ family: "quiet", id: "review_new" }],
      { now: "2026-06-26T00:00:00Z" },
    );

    assert.equal((result as any).status, "accepted");
    assert.equal((result as any).supersedesProjectionId, "proc_old_001");

    const all = await readProceduralProjectionsByCapabilityPattern(db, "github:issue.search");
    assert.equal(all.rows.length, 2);
    const installed = all.rows.find((r) => r.status === "installed");
    assert.ok(installed);
    assert.equal(installed.candidateId, "cand_new_001");
    const oldRow = all.rows.find((r) => r.id === "proc_old_001");
    assert.equal(oldRow?.status, "rejected");
  } finally {
    db.close();
  }
});

test("T5.2.1 v9 Dream runner blocks placeholder reviews", async () => {
  const db = createStateDatabase(":memory:");
  try {
    const reviewWrite = await writeQuietDailyReview(db, {
      id: "review_t521_placeholder",
      day: "2026-06-26",
      sourceRefs: [{ uri: "sn://evidence/ev1", family: "evidence", id: "ev1", redactionClass: "none", resolveStatus: "resolvable" }],
      payloadJson: seedReviewPayload({ contentStatus: "placeholder_rejected" }),
      createdAt: "2026-06-26T00:00:00Z",
    });
    if ("ownerStage" in reviewWrite) throw new Error("review write failed");
    const reviewId = reviewWrite.id;

    const runWrite = await writeDreamConsolidationRun(db, {
      id: "run_t521_placeholder",
      quietReviewId: reviewId,
      status: "started",
      sourceRefs: [{ uri: "sn://quiet/review_t521_placeholder", family: "quiet_review", id: reviewId, redactionClass: "none", resolveStatus: "resolvable" }],
      createdAt: "2026-06-26T01:00:00Z",
    });
    if ("ownerStage" in runWrite) throw new Error("run write failed");
    const runId = runWrite.id;

    const result = await runV9DreamConsolidation(db, runId);
    assert.equal(result.status, "blocked");
    assert.equal((result as any).reason, "dream_blocked_no_content");
  } finally {
    db.close();
  }
});
