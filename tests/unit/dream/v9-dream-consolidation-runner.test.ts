/**
 * v9 DreamConsolidationRunner — Unit Tests
 *
 * Validates: output family routing, content missing/placeholder blocking,
 * redaction blocking, procedural candidate validation requirements.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { runV9DreamConsolidation } from "../../../src/core/second-nature/quiet-dream/v9-dream-consolidation-runner.js";
import type { StateDatabase } from "../../../src/storage/db/index.js";
import type { DreamConsolidationRunRecord, QuietDailyReviewRecord } from "../../../src/storage/db/schema/v8-entities.js";

function makeMockRunAndReview(runId: string, reviewPayload: Record<string, unknown>) {
  const reviewId = `review_${runId}`;
  const review: QuietDailyReviewRecord = {
    id: reviewId,
    day: "2026-06-26",
    closureCount: 0,
    memoryCandidateCount: 0,
    sourceRefsJson: JSON.stringify([{ uri: "sn://test/1", family: "evidence", id: "ev1", redactionClass: "none", resolveStatus: "resolvable" }]),
    closureRefsJson: null,
    redactionClass: "none",
    payloadJson: JSON.stringify(reviewPayload),
    lifecycleStatus: "perceived",
    createdAt: "2026-06-26T00:00:00Z",
  };
  const run: DreamConsolidationRunRecord = {
    id: runId,
    quietReviewId: reviewId,
    status: "started",
    reason: null,
    sourceRefsJson: JSON.stringify([{ uri: "sn://quiet/review", family: "quiet_review", id: reviewId, redactionClass: "none", resolveStatus: "resolvable" }]),
    redactionClass: "none",
    payloadJson: null,
    createdAt: "2026-06-26T01:00:00Z",
  };
  return { run, review };
}

function makeMockDb(runId: string, reviewPayload: Record<string, unknown>): StateDatabase {
  const { run, review } = makeMockRunAndReview(runId, reviewPayload);
  let selectCount = 0;
  return {
    sqlite: null as any,
    schema: null as any,
    flush() {},
    close() {},
    db: {
      select: () => ({
        from: () => ({
          where: () => {
            selectCount++;
            const row = selectCount === 1 ? (runId === "run_missing" ? undefined : run) : review;
            return {
              limit: () => [row],
              orderBy: () => [row],
            };
          },
        }),
      }),
      insert: () => ({ values: () => Promise.resolve() }),
      update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    } as any,
  };
}

describe("v9-dream-consolidation-runner", () => {
  it("returns degraded when run cannot be read", async () => {
    const db = makeMockDb("run_missing", {});
    const result = await runV9DreamConsolidation(db, "run_missing");
    assert.ok("ownerStage" in result, "expected degraded result");
    assert.equal((result as any).status, "unavailable");
  });

  it("blocks run when quiet review has no content", async () => {
    const db = makeMockDb("run_empty", { contentStatus: "empty" });
    const result = await runV9DreamConsolidation(db, "run_empty");
    assert.ok("status" in result && (result as any).status === "blocked", "expected blocked");
    assert.equal((result as any).reason, "dream_blocked_no_content");
  });

  it("blocks run when all candidates fail validation", async () => {
    const db = makeMockDb("run_invalid", { contentStatus: "content_present", reviewSummary: "" });
    const result = await runV9DreamConsolidation(db, "run_invalid");
    assert.ok("status" in result && (result as any).status === "blocked", "expected blocked");
    assert.equal((result as any).reason, "dream_blocked_no_content");
  });

  it("redacts credential-shaped candidate text", async () => {
    const db = makeMockDb("run_credential", {
      contentStatus: "content_present",
      reviewSummary: "token: abc123xyz_secret_here",
    });
    const result = await runV9DreamConsolidation(db, "run_credential");
    const candidates = (result as any).candidates as Array<{ candidateText: string; validationStatus: string; validationReason?: string }>;
    const blocked = candidates.find((c) => c.validationStatus === "blocked" && c.validationReason === "dream_blocked_credential");
    assert.ok(blocked, "expected credential redaction block");
    assert.ok(blocked.candidateText.includes("[redacted"));
  });

  it("emits memory and procedural candidates for valid review", async () => {
    const db = makeMockDb("run_valid", {
      contentStatus: "content_present",
      reviewSummary: "daily summary",
      routineSignals: [{ capabilityPattern: "github:issue.search", summary: "searched issues" }],
    });
    const result = await runV9DreamConsolidation(db, "run_valid");
    assert.equal((result as any).status, "completed");
    const candidates = (result as any).candidates as Array<{ family: string; validationStatus: string }>;
    assert.ok(candidates.some((c) => c.family === "memory" && c.validationStatus === "valid"));
    assert.ok(candidates.some((c) => c.family === "procedural" && c.validationStatus === "valid"));
    assert.ok((result as any).outputFamilies.includes("memory"));
    assert.ok((result as any).outputFamilies.includes("procedural"));
  });
});
