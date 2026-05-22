/**
 * HistoryDigestStore tests — T-SMS.C.7
 *
 * Coverage:
 * - appendNarrativeTimeline is append-only (no overwrite)
 * - listNarrativeTimeline filters by subjectId
 * - writeHeartbeatDigest + loadHeartbeatDigest round-trip
 * - HeartbeatDigest day-keyed upsert semantics
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import type { StateDatabase } from "../../../src/storage/db/index.js";
import { createHistoryDigestStore } from "../../../src/storage/services/history-digest-store.js";

describe("HistoryDigestStore", () => {
  it("appendNarrativeTimeline is append-only", async () => {
    const db = createStateDatabase(":memory:");
    const store = createHistoryDigestStore(db);

    await store.appendNarrativeTimeline({
      timelineId: "tl-1",
      entryType: "mood_delta",
      subjectId: "user-1",
      delta: { mood: 0.8 },
      previousHash: "h0",
      currentHash: "h1",
      createdAt: "2025-01-01T00:00:00Z",
    });
    await store.appendNarrativeTimeline({
      timelineId: "tl-2",
      entryType: "mood_delta",
      subjectId: "user-1",
      delta: { mood: 0.9 },
      previousHash: "h1",
      currentHash: "h2",
      createdAt: "2025-01-02T00:00:00Z",
    });

    const all = await store.listNarrativeTimeline({ limit: 10 });
    assert.strictEqual(all.length, 2);
    assert.strictEqual(all[0]!.timelineId, "tl-2");
    assert.strictEqual(all[1]!.timelineId, "tl-1");
    db.close();
  });

  it("listNarrativeTimeline filters by subjectId", async () => {
    const db = createStateDatabase(":memory:");
    const store = createHistoryDigestStore(db);

    await store.appendNarrativeTimeline({
      timelineId: "tl-a",
      entryType: "goal_created",
      subjectId: "user-1",
      delta: {},
      previousHash: "",
      currentHash: "ha",
      createdAt: "2025-01-01T00:00:00Z",
    });
    await store.appendNarrativeTimeline({
      timelineId: "tl-b",
      entryType: "goal_created",
      subjectId: "user-2",
      delta: {},
      previousHash: "",
      currentHash: "hb",
      createdAt: "2025-01-02T00:00:00Z",
    });

    const forUser1 = await store.listNarrativeTimeline({
      subjectId: "user-1",
      limit: 10,
    });
    assert.strictEqual(forUser1.length, 1);
    assert.strictEqual(forUser1[0]!.subjectId, "user-1");
    db.close();
  });

  it("writeHeartbeatDigest + loadHeartbeatDigest round-trip", async () => {
    const db = createStateDatabase(":memory:");
    const store = createHistoryDigestStore(db);

    const digest = {
      digestId: "hd-1",
      day: "2025-01-15",
      connectorSummary: [
        { platformId: "twitter", status: "ok", attemptCount: 3 },
      ],
      goalSummary: [{ kind: "daily", activeCount: 2 }],
      quietCount: 1,
      dreamCount: 0,
      breakerSummary: [],
      healthStatus: "ok",
      createdAt: "2025-01-15T23:59:59Z",
    };

    await store.writeHeartbeatDigest(digest);
    const loaded = await store.loadHeartbeatDigest("2025-01-15");
    assert.strictEqual(loaded!.day, "2025-01-15");
    assert.strictEqual(loaded!.connectorSummary.length, 1);
    assert.strictEqual(loaded!.quietCount, 1);
    assert.strictEqual(loaded!.healthStatus, "ok");
    db.close();
  });

  it("writeHeartbeatDigest upserts by day", async () => {
    const db = createStateDatabase(":memory:");
    const store = createHistoryDigestStore(db);

    await store.writeHeartbeatDigest({
      digestId: "hd-1",
      day: "2025-01-15",
      connectorSummary: [],
      goalSummary: [],
      quietCount: 1,
      dreamCount: 0,
      breakerSummary: [],
      healthStatus: "ok",
      createdAt: "2025-01-15T00:00:00Z",
    });

    await store.writeHeartbeatDigest({
      digestId: "hd-2",
      day: "2025-01-15",
      connectorSummary: [],
      goalSummary: [],
      quietCount: 3,
      dreamCount: 1,
      breakerSummary: [],
      healthStatus: "degraded",
      createdAt: "2025-01-15T12:00:00Z",
    });

    const loaded = await store.loadHeartbeatDigest("2025-01-15");
    assert.strictEqual(loaded!.quietCount, 3);
    assert.strictEqual(loaded!.dreamCount, 1);
    assert.strictEqual(loaded!.healthStatus, "degraded");
    db.close();
  });
});
