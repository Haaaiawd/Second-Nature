/**
 * RestoreSnapshotStore tests — T-SMS.C.6
 *
 * Coverage:
 * - captureSnapshot with default whitelist
 * - captureSnapshot filters out sensitive kinds
 * - retention: only 3 most recent snapshots kept
 * - loadLatestSnapshot returns most recent
 * - listSnapshots orders by captured_at descending
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import type { StateDatabase } from "../../../src/storage/db/index.js";
import { createRestoreSnapshotStore } from "../../../src/storage/services/restore-snapshot-store.js";
import type { RestorableEntityKind } from "../../../src/shared/types/v7-entities.js";

describe("RestoreSnapshotStore", () => {
  it("captureSnapshot with default whitelist includes all 6 kinds", async () => {
    const db = createStateDatabase(":memory:");
    const store = createRestoreSnapshotStore(db, { retentionCount: 3 });
    const snap = await store.captureSnapshot({
      snapshotId: "snap-1",
      payload: { foo: "bar" },
    });
    assert.strictEqual(snap.entityWhitelist.length, 6);
    assert(snap.entityWhitelist.includes("identity_profile"));
    assert(snap.entityWhitelist.includes("narrative_timeline"));
    db.close();
  });

  it("captureSnapshot with custom whitelist filters to restorable kinds only", async () => {
    const db = createStateDatabase(":memory:");
    const store = createRestoreSnapshotStore(db, { retentionCount: 3 });
    const custom: RestorableEntityKind[] = ["identity_profile", "agent_goal"];
    const snap = await store.captureSnapshot({
      snapshotId: "snap-2",
      entityWhitelist: custom,
      payload: { test: true },
    });
    assert.deepStrictEqual(snap.entityWhitelist, custom);
    db.close();
  });

  it("captureSnapshot excludes sensitive kinds by default", async () => {
    const db = createStateDatabase(":memory:");
    const store = createRestoreSnapshotStore(db, { retentionCount: 3 });
    const snap = await store.captureSnapshot({
      snapshotId: "snap-3",
      payload: {},
    });
    assert(snap.excludedSensitiveKinds.includes("credential"));
    assert(snap.excludedSensitiveKinds.includes("encryption_key"));
    assert(snap.excludedSensitiveKinds.includes("session_token"));
    db.close();
  });

  it("retention trims oldest when exceeding limit", async () => {
    const db = createStateDatabase(":memory:");
    const store = createRestoreSnapshotStore(db, { retentionCount: 3 });
    for (let i = 1; i <= 4; i++) {
      await store.captureSnapshot({
        snapshotId: `snap-${i}`,
        payload: { idx: i },
        capturedAt: new Date(Date.now() + i * 1000).toISOString(),
      });
    }
    const all = await store.listSnapshots(10);
    assert.strictEqual(all.length, 3);
    assert.deepStrictEqual(
      all.map((s) => s.snapshotId),
      ["snap-4", "snap-3", "snap-2"],
    );
    db.close();
  });

  it("loadLatestSnapshot returns the most recent", async () => {
    const db = createStateDatabase(":memory:");
    const store = createRestoreSnapshotStore(db, { retentionCount: 3 });
    await store.captureSnapshot({
      snapshotId: "snap-a",
      payload: { v: 1 },
      capturedAt: "2025-01-01T00:00:00Z",
    });
    await store.captureSnapshot({
      snapshotId: "snap-b",
      payload: { v: 2 },
      capturedAt: "2025-01-02T00:00:00Z",
    });
    const latest = await store.loadLatestSnapshot();
    assert.strictEqual(latest?.snapshotId, "snap-b");
    assert.deepStrictEqual(latest?.payload, { v: 2 });
    db.close();
  });

  it("loadLatestSnapshot returns undefined when empty", async () => {
    const db = createStateDatabase(":memory:");
    const store = createRestoreSnapshotStore(db, { retentionCount: 3 });
    const latest = await store.loadLatestSnapshot();
    assert.strictEqual(latest, undefined);
    db.close();
  });

  it("listSnapshots respects limit", async () => {
    const db = createStateDatabase(":memory:");
    const store = createRestoreSnapshotStore(db, { retentionCount: 3 });
    for (let i = 1; i <= 5; i++) {
      await store.captureSnapshot({
        snapshotId: `snap-${i}`,
        payload: { idx: i },
      });
    }
    const limited = await store.listSnapshots(2);
    assert.strictEqual(limited.length, 2);
    db.close();
  });
});
