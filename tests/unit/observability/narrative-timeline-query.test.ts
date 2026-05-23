/**
 * Tests for NarrativeTimelineQueryService — T-OBS.C.5
 *
 * Verification plan §t-obs-c-5:
 *   1. cursor pagination: 100 rows → returns limit + nextCursor
 *   2. 90-day range exceeded → throws NarrativeQueryRangeError (query_range_exceeded)
 *   3. narrativeDiff returns focus/progress/nextIntent/sourceRefs/reasonCode changes
 *   4. nextCursor is undefined when all rows fit in one page
 *   5. cursor decodes back to same timestamp (roundtrip)
 *   6. limit clamped to MAX (30) even when caller requests more
 *   7. diff: isNoChange = true when both snapshots are identical
 *   8. diff: sourceRefs added/removed computed correctly
 *   9. diff: throws NarrativeVersionNotFoundError when version missing
 *  10. DR-032: state-memory unavailable → propagates the error (caller handles degradation)
 *  11. default limit applied when opts.limit is undefined
 *  12. cursor pagination: second page fetches entries after cursor boundary
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  queryNarrativeTimeline,
  queryNarrativeDiff,
  encodeCursor,
  decodeCursor,
  NarrativeQueryRangeError,
  NarrativeVersionNotFoundError,
  type NarrativeTimelineDeps,
  type NarrativeTimelineRow,
  type NarrativeSnapshotRow,
} from "../../../src/observability/services/narrative-timeline-query-service.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRow(version: string, createdAt: string): NarrativeTimelineRow {
  return {
    version,
    createdAt,
    triggerKind: "heartbeat.decision",
    sourceRefs: ["ref-1"],
    reasonCode: "test_reason",
    summaryText: "summary",
  };
}

function makeRows(count: number, baseDate = "2026-01-01T00:00:00.000Z"): NarrativeTimelineRow[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(baseDate);
    d.setMinutes(d.getMinutes() + i);
    return makeRow(`v${i + 1}`, d.toISOString());
  });
}

function makeSnap(
  version: string,
  fields: Partial<NarrativeSnapshotRow> = {}
): NarrativeSnapshotRow {
  return {
    version,
    focus: "default_focus",
    progress: "default_progress",
    nextIntent: "default_next",
    toneSignal: "neutral",
    acceptedGoalId: "goal-1",
    sourceRefs: ["ref-1", "ref-2"],
    lastChangeReasonCode: "goal_accepted",
    ...fields,
  };
}

function makeDeps(
  rows: NarrativeTimelineRow[],
  snaps: Record<string, NarrativeSnapshotRow> = {}
): NarrativeTimelineDeps {
  return {
    stateMemoryPort: {
      listNarrativeTimeline: async (_from, _to, opts) => {
        let filtered = rows;
        if (opts?.afterTimestamp) {
          filtered = rows.filter((r) => r.createdAt > opts.afterTimestamp!);
        }
        const limit = opts?.limit ?? rows.length;
        return filtered.slice(0, limit);
      },
      getNarrativeSnapshot: async (version) => snaps[version] ?? null,
    },
    now: () => "2026-05-01T00:00:00.000Z",
  };
}

const FROM = "2026-01-01T00:00:00.000Z";
const TO = "2026-01-30T00:00:00.000Z"; // 29 days

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("queryNarrativeTimeline — cursor pagination", () => {
  it("100 rows → returns limit=20 entries + nextCursor", async () => {
    const rows = makeRows(100);
    const deps = makeDeps(rows);
    const page = await queryNarrativeTimeline(FROM, TO, { limit: 20 }, deps);

    assert.equal(page.entries.length, 20);
    assert.ok(page.nextCursor !== undefined, "should have nextCursor");
    assert.equal(page.truncated, true);
  });

  it("fewer rows than limit → no nextCursor, truncated=false", async () => {
    const rows = makeRows(5);
    const deps = makeDeps(rows);
    const page = await queryNarrativeTimeline(FROM, TO, { limit: 20 }, deps);

    assert.equal(page.entries.length, 5);
    assert.equal(page.nextCursor, undefined);
    assert.equal(page.truncated, false);
  });

  it("default limit = 20 when opts.limit is undefined", async () => {
    const rows = makeRows(25);
    const deps = makeDeps(rows);
    const page = await queryNarrativeTimeline(FROM, TO, {}, deps);

    assert.equal(page.entries.length, 20);
    assert.ok(page.nextCursor !== undefined);
  });

  it("limit clamped to 30 (MAX_VERSIONS_PER_PAGE) when requested > 30", async () => {
    const rows = makeRows(50);
    const deps = makeDeps(rows);
    const page = await queryNarrativeTimeline(FROM, TO, { limit: 999 }, deps);

    assert.equal(page.entries.length, 30);
    assert.ok(page.nextCursor !== undefined);
  });

  it("second page fetches entries after cursor boundary", async () => {
    const rows = makeRows(30);
    const deps = makeDeps(rows);

    const page1 = await queryNarrativeTimeline(FROM, TO, { limit: 10 }, deps);
    assert.equal(page1.entries.length, 10);
    assert.ok(page1.nextCursor);

    const page2 = await queryNarrativeTimeline(
      FROM,
      TO,
      { limit: 10, cursor: page1.nextCursor },
      deps
    );

    // Pages must not overlap
    const page1Versions = new Set(page1.entries.map((e) => e.version));
    const page2Versions = new Set(page2.entries.map((e) => e.version));
    for (const v of page2Versions) {
      assert.ok(!page1Versions.has(v), `version ${v} should not appear in page 1`);
    }
    assert.equal(page2.entries.length, 10);
  });

  it("from/to are echoed back in the result", async () => {
    const deps = makeDeps([]);
    const page = await queryNarrativeTimeline(FROM, TO, {}, deps);
    assert.equal(page.from, FROM);
    assert.equal(page.to, TO);
  });
});

describe("queryNarrativeTimeline — range validation", () => {
  it("throws NarrativeQueryRangeError when range > 90 days", async () => {
    const deps = makeDeps([]);
    // Jan 1 → Apr 2 = 91 days (31 Jan + 28 Feb + 31 Mar + 1 Apr = 91)
    const farTo = "2026-04-02T00:00:00.000Z";
    await assert.rejects(
      () => queryNarrativeTimeline(FROM, farTo, {}, deps),
      (err: unknown) => {
        assert.ok(err instanceof NarrativeQueryRangeError);
        assert.equal((err as NarrativeQueryRangeError).code, "query_range_exceeded");
        return true;
      }
    );
  });

  it("exactly 90 days does NOT throw", async () => {
    const deps = makeDeps([]);
    // Jan 1 → Apr 1 = 31 + 28 + 31 = 90 days exactly
    const from = "2026-01-01T00:00:00.000Z";
    const to = "2026-04-01T00:00:00.000Z";
    await assert.doesNotReject(() =>
      queryNarrativeTimeline(from, to, {}, deps)
    );
  });
});

describe("queryNarrativeTimeline — cursor roundtrip", () => {
  it("encodeCursor / decodeCursor are inverse operations", () => {
    const ts = "2026-01-15T10:30:00.000Z";
    const cursor = encodeCursor(ts);
    const decoded = decodeCursor(cursor);
    assert.equal(decoded.ts, ts);
  });

  it("decodeCursor throws on garbage input", () => {
    assert.throws(() => decodeCursor("not-a-valid-cursor!!"), /invalid_cursor/);
  });
});

describe("queryNarrativeDiff", () => {
  it("returns changes for differing fields", async () => {
    const from = makeSnap("v1", { focus: "old_focus", progress: "old_prog" });
    const to = makeSnap("v2", {
      focus: "new_focus",
      progress: "new_prog",
      acceptedGoalId: "goal-2",
      lastChangeReasonCode: "goal_accepted",
    });
    const deps = makeDeps([], { v1: from, v2: to });

    const diff = await queryNarrativeDiff("v1", "v2", deps);

    assert.equal(diff.fromVersion, "v1");
    assert.equal(diff.toVersion, "v2");
    assert.equal(diff.reasonCode, "goal_accepted");
    assert.equal(diff.isNoChange, false);

    const changedFields = diff.changes.map((c) => c.field);
    assert.ok(changedFields.includes("focus"), "should include focus");
    assert.ok(changedFields.includes("progress"), "should include progress");
    assert.ok(changedFields.includes("acceptedGoalId"), "should include acceptedGoalId");

    const focusChange = diff.changes.find((c) => c.field === "focus")!;
    assert.equal(focusChange.from, "old_focus");
    assert.equal(focusChange.to, "new_focus");
  });

  it("isNoChange = true when snapshots are identical", async () => {
    const snap = makeSnap("v1");
    const deps = makeDeps([], { v1: snap, v2: snap });

    const diff = await queryNarrativeDiff("v1", "v2", deps);
    assert.equal(diff.isNoChange, true);
    assert.equal(diff.changes.length, 0);
    assert.equal(diff.sourceRefChanges.added.length, 0);
    assert.equal(diff.sourceRefChanges.removed.length, 0);
  });

  it("computes sourceRefs added/removed", async () => {
    const from = makeSnap("v1", { sourceRefs: ["ref-a", "ref-b"] });
    const to = makeSnap("v2", {
      sourceRefs: ["ref-b", "ref-c"],
      focus: makeSnap("v1").focus as string, // keep other fields same
    });
    // Force identical scalar fields so only sourceRefs differ
    const toSnap = makeSnap("v2", {
      ...from,
      version: "v2",
      sourceRefs: ["ref-b", "ref-c"],
    });
    const deps = makeDeps([], { v1: from, v2: toSnap });

    const diff = await queryNarrativeDiff("v1", "v2", deps);
    assert.deepEqual(diff.sourceRefChanges.added, ["ref-c"]);
    assert.deepEqual(diff.sourceRefChanges.removed, ["ref-a"]);
  });

  it("throws NarrativeVersionNotFoundError for unknown fromVersion", async () => {
    const snap = makeSnap("v2");
    const deps = makeDeps([], { v2: snap });

    await assert.rejects(
      () => queryNarrativeDiff("v1_missing", "v2", deps),
      (err: unknown) => {
        assert.ok(err instanceof NarrativeVersionNotFoundError);
        assert.equal((err as NarrativeVersionNotFoundError).code, "narrative_version_not_found");
        return true;
      }
    );
  });

  it("throws NarrativeVersionNotFoundError for unknown toVersion", async () => {
    const snap = makeSnap("v1");
    const deps = makeDeps([], { v1: snap });

    await assert.rejects(
      () => queryNarrativeDiff("v1", "v99_missing", deps),
      NarrativeVersionNotFoundError
    );
  });

  it("uses injected now() for computedAt", async () => {
    const snap = makeSnap("v1");
    const deps: NarrativeTimelineDeps = {
      ...makeDeps([], { v1: snap, v2: snap }),
      now: () => "2026-05-01T12:00:00.000Z",
    };
    const diff = await queryNarrativeDiff("v1", "v2", deps);
    assert.equal(diff.computedAt, "2026-05-01T12:00:00.000Z");
  });
});

describe("DR-032 — state-memory unavailable", () => {
  it("queryNarrativeTimeline propagates error from listNarrativeTimeline", async () => {
    const deps: NarrativeTimelineDeps = {
      stateMemoryPort: {
        listNarrativeTimeline: async () => {
          throw new Error("state_memory_unavailable");
        },
        getNarrativeSnapshot: async () => null,
      },
    };
    await assert.rejects(
      () => queryNarrativeTimeline(FROM, TO, {}, deps),
      /state_memory_unavailable/
    );
  });
});
