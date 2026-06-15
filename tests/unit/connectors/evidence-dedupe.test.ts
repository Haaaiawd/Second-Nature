/**
 * Evidence deduplication tests (T-CS.R.5)
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { readEvidenceItemsByStatus } from "../../../src/storage/v8-state-stores.js";
import { normalizeConnectorEvidence } from "../../../src/connectors/evidence-normalizer.js";

describe("evidence deduplication", () => {
  it("does not duplicate identical externalId within a batch", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const result = await normalizeConnectorEvidence(db, {
        status: "success",
        platformId: "moltbook",
        capabilityId: "feed.read",
        data: {
          posts: [
            { id: "post_001", title: "A", content: "content A" },
            { id: "post_001", title: "A", content: "content A" },
          ],
        },
        observedAt: "2026-06-15T10:00:00Z",
      });

      assert.equal(result.evidenceIds.length, 1);
      const pending = await readEvidenceItemsByStatus(db, "pending");
      assert.equal(pending.rows.length, 1);
    } finally {
      db.close();
    }
  });

  it("does not conflate same externalId across different platforms", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const r1 = await normalizeConnectorEvidence(db, {
        status: "success",
        platformId: "moltbook",
        capabilityId: "feed.read",
        data: { posts: [{ id: "post_001", title: "A", content: "content A" }] },
        observedAt: "2026-06-15T10:00:00Z",
      });
      const r2 = await normalizeConnectorEvidence(db, {
        status: "success",
        platformId: "instreet",
        capabilityId: "feed.read",
        data: { posts: [{ id: "post_001", title: "A", content: "content A" }] },
        observedAt: "2026-06-15T10:00:00Z",
      });

      assert.equal(r1.evidenceIds.length, 1);
      assert.equal(r2.evidenceIds.length, 1);
      assert.notEqual(r1.evidenceIds[0], r2.evidenceIds[0]);
    } finally {
      db.close();
    }
  });

  it("updates observedAt on repeat instead of creating a duplicate", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const r1 = await normalizeConnectorEvidence(db, {
        status: "success",
        platformId: "moltbook",
        capabilityId: "feed.read",
        data: { posts: [{ id: "post_001", title: "A", content: "content A" }] },
        observedAt: "2026-06-15T10:00:00Z",
      });
      const r2 = await normalizeConnectorEvidence(db, {
        status: "success",
        platformId: "moltbook",
        capabilityId: "feed.read",
        data: { posts: [{ id: "post_001", title: "A", content: "content A" }] },
        observedAt: "2026-06-15T10:30:00Z",
      });

      assert.equal(r1.evidenceIds[0], r2.evidenceIds[0]);
      const pending = await readEvidenceItemsByStatus(db, "pending");
      assert.equal(pending.rows.length, 1);
      assert.equal(pending.rows[0]?.observedAt, "2026-06-15T10:30:00Z");
    } finally {
      db.close();
    }
  });

  it("classifies credential-shaped content as sensitive and benign content as public_general", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const sensitive = await normalizeConnectorEvidence(db, {
        status: "success",
        platformId: "moltbook",
        capabilityId: "feed.read",
        data: { posts: [{ id: "s1", title: "Key", content: "api_key = 'sk-abc123def456ghi789jkl012mno345pqr'" }] },
        observedAt: "2026-06-15T10:00:00Z",
      });
      const benign = await normalizeConnectorEvidence(db, {
        status: "success",
        platformId: "moltbook",
        capabilityId: "feed.read",
        data: { posts: [{ id: "b1", title: "Token talk", content: "The token is used for authentication." }] },
        observedAt: "2026-06-15T10:00:00Z",
      });

      assert.equal(sensitive.evidenceIds.length, 1);
      assert.equal(benign.evidenceIds.length, 1);
      const rows = await readEvidenceItemsByStatus(db, "pending");
      const byId = new Map(rows.rows.map((r) => [r.id, r]));
      assert.equal(byId.get(sensitive.evidenceIds[0]!)?.sensitivityHint, "sensitive");
      assert.equal(byId.get(benign.evidenceIds[0]!)?.sensitivityHint, "public_general");
    } finally {
      db.close();
    }
  });
});
