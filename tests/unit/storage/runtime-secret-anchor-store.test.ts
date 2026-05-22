/**
 * RuntimeSecretAnchorStore tests — T-SMS.C.6
 *
 * Coverage:
 * - upsertAnchor stores locationRef/health/rotationPolicyRef
 * - upsertAnchor rejects payload with key plaintext (gate)
 * - loadAnchor returns stored record
 * - listAnchors returns all ordered by updated_at DESC
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import type { StateDatabase } from "../../../src/storage/db/index.js";
import { createRuntimeSecretAnchorStore } from "../../../src/storage/services/runtime-secret-anchor-store.js";

describe("RuntimeSecretAnchorStore", () => {
  it("upsertAnchor stores and updates", async () => {
    const db = createStateDatabase(":memory:");
    const store = createRuntimeSecretAnchorStore(db);

    await store.upsertAnchor({
      anchorId: "anchor-1",
      locationRef: "vault://secret-a",
      health: "ok",
      rotationPolicyRef: "policy://rotate-30d",
      updatedAt: "2025-01-01T00:00:00Z",
    });

    const loaded = await store.loadAnchor("anchor-1");
    assert.strictEqual(loaded!.locationRef, "vault://secret-a");
    assert.strictEqual(loaded!.health, "ok");
    assert.strictEqual(loaded!.rotationPolicyRef, "policy://rotate-30d");

    // Update
    await store.upsertAnchor({
      anchorId: "anchor-1",
      locationRef: "vault://secret-a-v2",
      health: "rotation_needed",
      updatedAt: "2025-02-01T00:00:00Z",
    });

    const updated = await store.loadAnchor("anchor-1");
    assert.strictEqual(updated!.locationRef, "vault://secret-a-v2");
    assert.strictEqual(updated!.health, "rotation_needed");
    assert.strictEqual(updated!.rotationPolicyRef, undefined);
    db.close();
  });

  it("upsertAnchor rejects key plaintext via gate", async () => {
    const db = createStateDatabase(":memory:");
    const store = createRuntimeSecretAnchorStore(db);

    await assert.rejects(
      store.upsertAnchor({
        anchorId: "anchor-bad",
        locationRef: "vault://sk-abcdefghijklmnopqrstuvwxyz123456",
        health: "ok",
        updatedAt: "2025-01-01T00:00:00Z",
      }),
      /write_validation_failed/,
    );
    db.close();
  });

  it("loadAnchor returns undefined for missing", async () => {
    const db = createStateDatabase(":memory:");
    const store = createRuntimeSecretAnchorStore(db);
    const loaded = await store.loadAnchor("missing");
    assert.strictEqual(loaded, undefined);
    db.close();
  });

  it("listAnchors returns all", async () => {
    const db = createStateDatabase(":memory:");
    const store = createRuntimeSecretAnchorStore(db);

    await store.upsertAnchor({
      anchorId: "a1",
      locationRef: "vault://1",
      health: "ok",
      updatedAt: "2025-01-01T00:00:00Z",
    });
    await store.upsertAnchor({
      anchorId: "a2",
      locationRef: "vault://2",
      health: "missing",
      updatedAt: "2025-01-02T00:00:00Z",
    });
    const list = await store.listAnchors();
    assert.strictEqual(list.length, 2);
    assert.strictEqual(list[0]!.anchorId, "a2");
    assert.strictEqual(list[1]!.anchorId, "a1");
    db.close();
  });
});
