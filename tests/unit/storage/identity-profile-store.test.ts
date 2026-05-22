/**
 * T-SMS.C.4 — IdentityProfileStore 单元测试
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createIdentityProfileStore } from "../../../src/storage/services/identity-profile-store.js";

describe("IdentityProfileStore", () => {
  it("upserts and loads identity profile", async () => {
    const db = createStateDatabase(":memory:");
    const store = createIdentityProfileStore(db);

    await store.upsertIdentityProfile({
      profileId: "prof-1",
      canonicalName: "Nyx",
      canonicalBio: "Architect",
      platformHandles: [
        { platformId: "moltbook", handle: "nyx_ha" },
        { platformId: "agent_world", handle: "haai-arch" },
        { platformId: "instreet", handle: "haai_17949e" },
      ],
      updatedAt: "2026-05-21T00:00:00Z",
    });

    const result = await store.loadIdentityProfile("prof-1");
    assert.strictEqual(result.status, "loaded");
    if (result.status === "loaded") {
      assert.strictEqual(result.profile.canonicalName, "Nyx");
      assert.strictEqual(result.profile.platformHandles.length, 3);
    }
  });

  it("returns degraded when platform missing", async () => {
    const db = createStateDatabase(":memory:");
    const store = createIdentityProfileStore(db);

    await store.upsertIdentityProfile({
      profileId: "prof-1",
      canonicalName: "Nyx",
      platformHandles: [{ platformId: "moltbook", handle: "nyx_ha" }],
      updatedAt: "2026-05-21T00:00:00Z",
    });

    const result = await store.loadIdentityProfile("prof-1");
    assert.strictEqual(result.status, "degraded");
  });

  it("returns not_found for unknown profile", async () => {
    const db = createStateDatabase(":memory:");
    const store = createIdentityProfileStore(db);

    const result = await store.loadIdentityProfile("unknown");
    assert.strictEqual(result.status, "not_found");
  });
});
