/**
 * v9 Digest & Timeline Read — API Tests (T8.2.3)
 *
 * Validates: `assembleDigest` and `queryTimeline` return JSON-serializable
 * shapes suitable for `digest.read` and `timeline.read` API surfaces.
 *
 * Verifies:
 * - Digest JSON shape with all sections
 * - Timeline JSON shape with pagination
 * - Redacted payload in timeline output
 * - No emotion/personality assertion text in digest
 * - Character frame event whitelist in timeline
 * - Empty window handling
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  assembleDigest,
  queryTimeline,
  filterCharacterFrameEvents,
  DIGEST_PERF,
  type DigestAssemblerDeps,
  type TimelineQueryDeps,
  type TimelineRowInput,
  type DigestAssemblerInputs,
} from "../../../src/observability/v9-digest-timeline.js";
import { validateCharacterSafety } from "../../../src/observability/v9-redaction-projector.js";
import type { SourceRef, TimelineFamily } from "../../../src/shared/types/v9-contracts.js";

const NOW = new Date("2026-06-28T14:00:00Z");

function makeDeps(): DigestAssemblerDeps {
  let idCounter = 0;
  return {
    now: () => NOW,
    generateId: () => `digest_${++idCounter}`,
  };
}

function makeInputs(): DigestAssemblerInputs {
  return {
    stageEvents: [
      { stageKind: "evidence", status: "ok", reasonCode: "loop_healthy" },
      { stageKind: "closure", status: "ok", reasonCode: "closure_completed" },
    ],
    cycleTraces: [{ closedAt: NOW.toISOString() }],
    activityHealth: [],
    continuityCardResult: {
      kind: "ok",
      isStale: false,
      card: { sourceRefs: [{ family: "evidence", id: "m1" } as SourceRef] },
      projections: [{ kind: "memory" }, { kind: "procedural" }],
    },
    routineRegistrySnapshot: {
      routines: [
        { routineId: "r1", capabilityPattern: "moltbook:feed.read", version: "1.0.0", status: "active", rollbackRef: "ref-1", sourceRefs: [] },
      ],
    },
    connectorEvolutionResult: {
      planId: "p1",
      platformId: "moltbook",
      gates: [{ name: "schema", result: "pass" }],
      canaryResult: "pass",
    },
    characterFrameEvents: [
      { frameId: "f1", eventKind: "accepted", sourceRefCount: 3 },
    ],
    ledgerEntries: [
      { sourceRefs: [{ family: "ledger", id: "l1" } as SourceRef] },
    ],
  };
}

describe("API v9-digest.read", () => {
  it("returns JSON-serializable digest shape", async () => {
    const digest = await assembleDigest(makeDeps(), makeInputs(), { workspaceRoot: "/ws" });
    const json = JSON.stringify(digest);
    assert.ok(json.length > 0);
    const parsed = JSON.parse(json);
    assert.ok(parsed.id);
    assert.ok(parsed.windowStart);
    assert.ok(parsed.windowEnd);
    assert.ok(parsed.sections);
    assert.ok(parsed.sourceRefCount >= 0);
    assert.ok(parsed.generatedAt);
  });

  it("exposes all 4 health sections", async () => {
    const digest = await assembleDigest(makeDeps(), makeInputs(), { workspaceRoot: "/ws" });
    assert.ok(digest.sections.loop);
    assert.ok(digest.sections.continuity);
    assert.ok(digest.sections.routine);
    assert.ok(digest.sections.connectorEvolution);
  });

  it("digest output passes character safety validation", async () => {
    const digest = await assembleDigest(makeDeps(), makeInputs(), { workspaceRoot: "/ws" });
    const json = JSON.stringify(digest);
    const safety = validateCharacterSafety(json);
    assert.ok(safety.safe, `Digest should be safe: ${safety.violatedPatterns.join(", ")}`);
  });

  it("includes sourceRefCount from ledger + events", async () => {
    const digest = await assembleDigest(makeDeps(), makeInputs(), { workspaceRoot: "/ws" });
    assert.ok(digest.sourceRefCount > 0);
  });

  it("handles empty window with no events", async () => {
    const inputs: DigestAssemblerInputs = {
      stageEvents: [],
      cycleTraces: [],
      activityHealth: [],
      continuityCardResult: { kind: "unavailable", reasonCode: "continuity_unavailable" },
      routineRegistrySnapshot: { routines: [] },
      connectorEvolutionResult: {
        planId: "p1",
        platformId: "moltbook",
        gates: [{ name: "schema", result: "pass" }],
      },
      characterFrameEvents: [],
      ledgerEntries: [],
    };
    const digest = await assembleDigest(makeDeps(), inputs, { workspaceRoot: "/ws" });
    assert.equal(digest.sourceRefCount, 0);
    assert.equal(digest.sections.continuity.cardAvailable, false);
  });
});

describe("API v9-timeline.read", () => {
  function makeRows(count: number, family: TimelineFamily = "stage_event"): TimelineRowInput[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `row-${i + 1}`,
      occurredAt: `2026-06-28T10:00:${String(i % 60).padStart(2, "0")}Z`,
      family,
      kind: "test_event",
      sourceRefs: [{ family: "evidence", id: `e${i + 1}` } as SourceRef],
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
        if (params.cursor) {
          const idx = filtered.findIndex((r) => r.id === params.cursor);
          filtered = idx >= 0 ? filtered.slice(idx + 1) : [];
        }
        return filtered.slice(0, params.limit);
      },
    };
  }

  it("returns JSON-serializable timeline page", async () => {
    const deps = makeQueryDeps(makeRows(3));
    const result = await queryTimeline(deps, { workspaceRoot: "/ws" }, NOW);
    const json = JSON.stringify(result);
    assert.ok(json.length > 0);
    const parsed = JSON.parse(json);
    assert.ok(Array.isArray(parsed.rows));
    assert.equal(parsed.rows.length, 3);
  });

  it("exposes nextCursor for pagination", async () => {
    const deps = makeQueryDeps(makeRows(60));
    const result = await queryTimeline(deps, { workspaceRoot: "/ws", limit: 10 }, NOW);
    assert.ok(result.nextCursor);
    assert.equal(result.rows.length, 10);
  });

  it("redacts sensitive fields in timeline payload", async () => {
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

  it("returns empty page for empty window", async () => {
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

  it("character frame events filtered to whitelist", () => {
    const rows: TimelineRowInput[] = [
      { id: "r1", occurredAt: NOW.toISOString(), family: "character_frame_event", kind: "accepted", sourceRefs: [], reasonCode: "ok" },
      { id: "r2", occurredAt: NOW.toISOString(), family: "character_frame_event", kind: "invalid", sourceRefs: [], reasonCode: "ok" },
      { id: "r3", occurredAt: NOW.toISOString(), family: "stage_event", kind: "evidence", sourceRefs: [], reasonCode: "ok" },
    ];
    const filtered = filterCharacterFrameEvents(rows);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].kind, "accepted");
  });
});
