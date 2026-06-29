/**
 * v9 Stable Identity Attention integration test.
 *
 * Verifies that EvidenceIdentityPort resolves a v8 evidence row into a
 * StableEvidenceIdentity with correct repetitionStatus and seenCount.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createEvidenceIdentityPort } from "../../../src/storage/v9-evidence-identity-port.js";
import { normalizeConnectorEvidence } from "../../../src/connectors/evidence-normalizer.js";

describe("v9 stable identity attention", () => {
  it("resolves first-seen evidence as new", async () => {
    const db = createStateDatabase(":memory:");
    try {
      await normalizeConnectorEvidence(db, {
        status: "success",
        platformId: "moltbook",
        capabilityId: "feed.read",
        data: { posts: [{ id: "post-1", title: "A", content: "content A" }] },
        observedAt: "2026-06-20T10:00:00Z",
      });

      const port = createEvidenceIdentityPort(db);
      const identity = await port.normalizeEvidenceIdentity({
        platformId: "moltbook",
        externalId: "post-1",
        observedAt: "2026-06-20T10:00:00Z",
      });

      assert.equal(identity.repetitionStatus, "new");
      assert.equal(identity.seenCount, 1);
      assert.equal(identity.platformId, "moltbook");
      assert.equal(identity.externalId, "post-1");
      assert.ok(identity.logicalId.startsWith("ev_moltbook"));
    } finally {
      db.close();
    }
  });

  it("marks missing externalId and contentHash as identity_unstable", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const port = createEvidenceIdentityPort(db);
      const identity = await port.normalizeEvidenceIdentity({
        platformId: "moltbook",
        observedAt: "2026-06-20T10:00:00Z",
      });

      assert.equal(identity.repetitionStatus, "identity_unstable");
      assert.equal(identity.seenCount, 0);
    } finally {
      db.close();
    }
  });
});
