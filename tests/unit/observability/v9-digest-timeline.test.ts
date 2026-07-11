/**
 * v9 Digest & Timeline — Unit Tests (T8.2.3)
 *
 * Validates:
 * - computeDigestWindow: default 24h, custom window
 * - clampTimelineWindow: max 7 days, truncation
 * - countUniqueSourceRefs: deduplication
 * - assembleDigest: sections + sourceRefCount + redacted output
 * - queryTimeline: family/kind filter, pagination, redaction
 * - filterCharacterFrameEvents: whitelist enforcement
 * - Empty window handling
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  assembleDigest,
  queryTimeline,
  computeDigestWindow,
  clampTimelineWindow,
  countUniqueSourceRefs,
  filterCharacterFrameEvents,
  DIGEST_PERF,
  CHARACTER_FRAME_EVENT_KINDS,
  type DigestAssemblerDeps,
  type TimelineQueryDeps,
  type TimelineRowInput,
  type DigestAssemblerInputs,
} from "../../../src/observability/v9-digest-timeline.js";
import { validateCharacterSafety } from "../../../src/observability/v9-redaction-projector.js";
import type { SourceRef, TimelineFamily } from "../../../src/shared/types/v9-contracts.js";

const NOW = new Date("2026-06-28T14:00:00Z");

// ───────────────────────────────────────────────────────────────
// computeDigestWindow
// ───────────────────────────────────────────────────────────────

describe("T8.2.3 computeDigestWindow", () => {
  it("defaults to 24h window", () => {
    const window = computeDigestWindow({ workspaceRoot: "/ws" }, NOW);
    assert.equal(window.hours, 24);
    assert.equal(window.end, NOW.toISOString());
  });

  it("uses custom windowHours", () => {
    const window = computeDigestWindow({ workspaceRoot: "/ws", windowHours: 48 }, NOW);
    assert.equal(window.hours, 48);
  });

  it("uses explicit windowStart/windowEnd", () => {
    const window = computeDigestWindow({
      workspaceRoot: "/ws",
      windowStart: "2026-06-28T00:00:00Z",
      windowEnd: "2026-06-28T12:00:00Z",
    }, NOW);
    assert.equal(window.start, "2026-06-28T00:00:00Z");
    assert.equal(window.end, "2026-06-28T12:00:00Z");
  });
});

// ───────────────────────────────────────────────────────────────
// clampTimelineWindow
// ───────────────────────────────────────────────────────────────

describe("T8.2.3 clampTimelineWindow", () => {
  it("clamps to max 7 days", () => {
    const window = clampTimelineWindow({
      workspaceRoot: "/ws",
      windowStart: "2026-06-01T00:00:00Z", // 27 days ago
      windowEnd: "2026-06-28T14:00:00Z",
    }, NOW);
    const elapsedMs = new Date(window.end).getTime() - new Date(window.start).getTime();
    const maxMs = DIGEST_PERF.TIMELINE_MAX_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    assert.ok(elapsedMs <= maxMs, "Window should be clamped to max 7 days");
  });

  it("does not clamp within 7 days", () => {
    const window = clampTimelineWindow({
      workspaceRoot: "/ws",
      windowStart: "2026-06-27T00:00:00Z", // 1.5 days ago
      windowEnd: "2026-06-28T14:00:00Z",
    }, NOW);
    // start should be the requested start (within 7-day max)
    assert.equal(new Date(window.start).getTime(), new Date("2026-06-27T00:00:00Z").getTime());
  });

  it("defaults to 7-day window when no start specified", () => {
    const window = clampTimelineWindow({ workspaceRoot: "/ws" }, NOW);
    const elapsedMs = new Date(window.end).getTime() - new Date(window.start).getTime();
    const maxMs = DIGEST_PERF.TIMELINE_MAX_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    assert.ok(elapsedMs <= maxMs);
  });
});

// ───────────────────────────────────────────────────────────────
// countUniqueSourceRefs
// ───────────────────────────────────────────────────────────────

describe("T8.2.3 countUniqueSourceRefs", () => {
  it("counts unique refs", () => {
    const events: { sourceRefs?: SourceRef[] }[] = [
      { sourceRefs: [{ family: "evidence", id: "e1" }, { family: "evidence", id: "e2" }] },
      { sourceRefs: [{ family: "evidence", id: "e1" }] }, // duplicate
    ];
    assert.equal(countUniqueSourceRefs(events), 2);
  });

  it("returns 0 for empty", () => {
    assert.equal(countUniqueSourceRefs([]), 0);
  });

  it("handles missing sourceRefs", () => {
    assert.equal(countUniqueSourceRefs([{}, {}]), 0);
  });
});

// ───────────────────────────────────────────────────────────────
// assembleDigest
// ───────────────────────────────────────────────────────────────

describe("T8.2.3 assembleDigest", () => {
  function makeDeps(): { deps: DigestAssemblerDeps; persisted: any[] } {
    const persisted: any[] = [];
    let idCounter = 0;
    return {
      deps: {
        now: () => NOW,
        generateId: () => `digest_${++idCounter}`,
        persistDigest: async (d) => { persisted.push(d); },
      },
      persisted,
    };
  }

  function makeInputs(): DigestAssemblerInputs {
    return {
      stageEvents: [
        { stageKind: "evidence", status: "ok", reasonCode: "loop_healthy" },
      ],
      cycleTraces: [{ closedAt: NOW.toISOString() }],
      activityHealth: [],
      continuityCardResult: {
        kind: "ok",
        isStale: false,
        card: { sourceRefs: [{ family: "evidence", id: "m1" }] },
        projections: [{ kind: "memory" }],
      },
      routineRegistrySnapshot: { routines: [] },
      connectorEvolutionResult: {
        planId: "p1",
        platformId: "moltbook",
        gates: [{ name: "schema", result: "pass" }],
      },
      characterFrameEvents: [],
      ledgerEntries: [
        { sourceRefs: [{ family: "ledger", id: "l1" }] },
      ],
    };
  }

  it("returns digest with all sections", async () => {
    const { deps } = makeDeps();
    const digest = await assembleDigest(deps, makeInputs(), { workspaceRoot: "/ws" });
    assert.ok(digest.sections.loop);
    assert.ok(digest.sections.continuity);
    assert.ok(digest.sections.routine);
    assert.ok(digest.sections.connectorEvolution);
  });

  it("includes sourceRefCount", async () => {
    const { deps } = makeDeps();
    const digest = await assembleDigest(deps, makeInputs(), { workspaceRoot: "/ws" });
    assert.ok(digest.sourceRefCount >= 0);
  });

  it("includes windowStart, windowEnd, generatedAt", async () => {
    const { deps } = makeDeps();
    const digest = await assembleDigest(deps, makeInputs(), { workspaceRoot: "/ws" });
    assert.ok(digest.windowStart);
    assert.ok(digest.windowEnd);
    assert.equal(digest.generatedAt, NOW.toISOString());
  });

  it("persists digest when persistDigest provided", async () => {
    const { deps, persisted } = makeDeps();
    const digest = await assembleDigest(deps, makeInputs(), { workspaceRoot: "/ws" });
    assert.equal(persisted.length, 1);
    assert.equal(persisted[0].id, digest.id);
  });

  it("does not persist when persistDigest not provided", async () => {
    let idCounter = 0;
    const deps: DigestAssemblerDeps = {
      now: () => NOW,
      generateId: () => `digest_${++idCounter}`,
    };
    const digest = await assembleDigest(deps, makeInputs(), { workspaceRoot: "/ws" });
    assert.ok(digest.id);
  });

  it("digest output is JSON-serializable", async () => {
    const { deps } = makeDeps();
    const digest = await assembleDigest(deps, makeInputs(), { workspaceRoot: "/ws" });
    const json = JSON.stringify(digest);
    assert.ok(json.length > 0);
    const parsed = JSON.parse(json);
    assert.ok(parsed.sections);
  });

  it("digest sections contain no emotion/personality text", async () => {
    const { deps } = makeDeps();
    const digest = await assembleDigest(deps, makeInputs(), { workspaceRoot: "/ws" });
    const json = JSON.stringify(digest);
    const safety = validateCharacterSafety(json);
    assert.ok(safety.safe, `Digest should be safe: ${safety.violatedPatterns.join(", ")}`);
  });
});

// ───────────────────────────────────────────────────────────────
// queryTimeline
// ───────────────────────────────────────────────────────────────

describe("T8.2.3 queryTimeline", () => {
  function makeRows(count: number, family: TimelineFamily = "stage_event"): TimelineRowInput[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `row-${i + 1}`,
      occurredAt: `2026-06-28T10:00:${String(i).padStart(2, "0")}Z`,
      family,
      kind: "test_event",
      sourceRefs: [{ family: "evidence", id: `e${i + 1}` }],
      redactedPayloadJson: JSON.stringify({ data: `event-${i + 1}` }),
      reasonCode: "loop_healthy",
    }));
  }

  function makeQueryDeps(rows: TimelineRowInput[]): TimelineQueryDeps {
    return {
      queryRows: async (params) => {
        let filtered = rows;
        if (params.family) filtered = filtered.filter((r) => r.family === params.family);
        if (params.kind) filtered = filtered.filter((r) => r.kind === params.kind);
        if (params.sourceRef) {
          filtered = filtered.filter((r) =>
            r.sourceRefs.some((s) => `${s.family}:${s.id}` === params.sourceRef),
          );
        }
        // Cursor pagination
        if (params.cursor) {
          const cursorIdx = filtered.findIndex((r) => r.id === params.cursor);
          filtered = cursorIdx >= 0 ? filtered.slice(cursorIdx + 1) : [];
        }
        return filtered.slice(0, params.limit);
      },
    };
  }

  it("returns rows with redacted payload", async () => {
    const deps = makeQueryDeps(makeRows(3));
    const result = await queryTimeline(deps, { workspaceRoot: "/ws" }, NOW);
    assert.equal(result.rows.length, 3);
    assert.ok(result.rows[0].redactedPayloadJson);
  });

  it("paginates with limit", async () => {
    const deps = makeQueryDeps(makeRows(60));
    const result = await queryTimeline(deps, { workspaceRoot: "/ws", limit: 10 }, NOW);
    assert.equal(result.rows.length, 10);
    assert.ok(result.nextCursor);
  });

  it("returns no nextCursor when no more rows", async () => {
    const deps = makeQueryDeps(makeRows(5));
    const result = await queryTimeline(deps, { workspaceRoot: "/ws", limit: 10 }, NOW);
    assert.equal(result.rows.length, 5);
    assert.equal(result.nextCursor, undefined);
  });

  it("filters by family", async () => {
    const rows = [
      ...makeRows(3, "stage_event"),
      ...makeRows(2, "ledger"),
    ];
    const deps = makeQueryDeps(rows);
    const result = await queryTimeline(deps, { workspaceRoot: "/ws", family: "ledger" }, NOW);
    assert.equal(result.rows.length, 2);
    assert.equal(result.rows[0].family, "ledger");
  });

  it("filters by kind", async () => {
    const rows: TimelineRowInput[] = [
      { id: "r1", occurredAt: NOW.toISOString(), family: "stage_event", kind: "evidence", sourceRefs: [], reasonCode: "ok" },
      { id: "r2", occurredAt: NOW.toISOString(), family: "stage_event", kind: "closure", sourceRefs: [], reasonCode: "ok" },
    ];
    const deps = makeQueryDeps(rows);
    const result = await queryTimeline(deps, { workspaceRoot: "/ws", kind: "closure" }, NOW);
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].kind, "closure");
  });

  it("filters by sourceRef", async () => {
    const rows: TimelineRowInput[] = [
      { id: "r1", occurredAt: NOW.toISOString(), family: "stage_event", kind: "test", sourceRefs: [{ family: "evidence", id: "e1" }], reasonCode: "ok" },
      { id: "r2", occurredAt: NOW.toISOString(), family: "stage_event", kind: "test", sourceRefs: [{ family: "evidence", id: "e2" }], reasonCode: "ok" },
    ];
    const deps = makeQueryDeps(rows);
    const result = await queryTimeline(deps, { workspaceRoot: "/ws", sourceRef: "evidence:e1" }, NOW);
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].id, "r1");
  });

  it("returns empty for empty window", async () => {
    const deps = makeQueryDeps([]);
    const result = await queryTimeline(deps, { workspaceRoot: "/ws" }, NOW);
    assert.equal(result.rows.length, 0);
    assert.equal(result.nextCursor, undefined);
  });

  it("clamps limit to TIMELINE_MAX_LIMIT", async () => {
    const deps = makeQueryDeps(makeRows(200));
    const result = await queryTimeline(deps, { workspaceRoot: "/ws", limit: 200 }, NOW);
    assert.equal(result.rows.length, DIGEST_PERF.TIMELINE_MAX_LIMIT);
  });

  it("redacts sensitive fields in payload", async () => {
    const rows: TimelineRowInput[] = [
      {
        id: "r1",
        occurredAt: NOW.toISOString(),
        family: "stage_event",
        kind: "test",
        sourceRefs: [],
        redactedPayloadJson: JSON.stringify({ token: "short", data: "normal" }),
        reasonCode: "ok",
      },
    ];
    const deps = makeQueryDeps(rows);
    const result = await queryTimeline(deps, { workspaceRoot: "/ws" }, NOW);
    const payload = JSON.parse(result.rows[0].redactedPayloadJson ?? "{}");
    assert.equal(payload.token, "[MASKED]");
    assert.equal(payload.data, "normal");
  });
});

// ───────────────────────────────────────────────────────────────
// filterCharacterFrameEvents
// ───────────────────────────────────────────────────────────────

describe("T8.2.3 filterCharacterFrameEvents", () => {
  it("filters to whitelisted character frame event kinds", () => {
    const rows: TimelineRowInput[] = [
      { id: "r1", occurredAt: NOW.toISOString(), family: "character_frame_event", kind: "accepted", sourceRefs: [], reasonCode: "ok" },
      { id: "r2", occurredAt: NOW.toISOString(), family: "character_frame_event", kind: "deferred", sourceRefs: [], reasonCode: "ok" },
      { id: "r3", occurredAt: NOW.toISOString(), family: "stage_event", kind: "evidence", sourceRefs: [], reasonCode: "ok" },
    ];
    const filtered = filterCharacterFrameEvents(rows);
    assert.equal(filtered.length, 2);
    assert.equal(filtered[0].kind, "accepted");
    assert.equal(filtered[1].kind, "deferred");
  });

  it("excludes non-whitelisted kinds", () => {
    const rows: TimelineRowInput[] = [
      { id: "r1", occurredAt: NOW.toISOString(), family: "character_frame_event", kind: "invalid_kind", sourceRefs: [], reasonCode: "ok" },
    ];
    const filtered = filterCharacterFrameEvents(rows);
    assert.equal(filtered.length, 0);
  });

  it("excludes non-character_frame_event families", () => {
    const rows: TimelineRowInput[] = [
      { id: "r1", occurredAt: NOW.toISOString(), family: "stage_event", kind: "accepted", sourceRefs: [], reasonCode: "ok" },
    ];
    const filtered = filterCharacterFrameEvents(rows);
    assert.equal(filtered.length, 0);
  });
});

// ───────────────────────────────────────────────────────────────
// CHARACTER_FRAME_EVENT_KINDS
// ───────────────────────────────────────────────────────────────

describe("T8.2.3 CHARACTER_FRAME_EVENT_KINDS", () => {
  it("includes all 8 kinds", () => {
    assert.equal(CHARACTER_FRAME_EVENT_KINDS.length, 8);
    assert.ok(CHARACTER_FRAME_EVENT_KINDS.includes("refresh"));
    assert.ok(CHARACTER_FRAME_EVENT_KINDS.includes("accepted"));
    assert.ok(CHARACTER_FRAME_EVENT_KINDS.includes("rejected"));
    assert.ok(CHARACTER_FRAME_EVENT_KINDS.includes("revised"));
    assert.ok(CHARACTER_FRAME_EVENT_KINDS.includes("retired"));
    assert.ok(CHARACTER_FRAME_EVENT_KINDS.includes("superseded"));
    assert.ok(CHARACTER_FRAME_EVENT_KINDS.includes("deferred"));
    assert.ok(CHARACTER_FRAME_EVENT_KINDS.includes("conflict"));
  });
});
