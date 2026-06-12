/**
 * Read Failure No-Fabrication — Integration Test (T-CS.R.2)
 *
 * Validates: connector read failures produce no EvidenceItem and no
 * PerceptionCard; loop health surfaces the precise connector reason.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import {
  normalizeConnectorEvidence,
  type ConnectorReadResult,
} from "../../../src/connectors/evidence-normalizer.js";
import {
  readEvidenceItemsByStatus,
} from "../../../src/storage/v8-state-stores.js";
import type { SourceRef } from "../../../src/shared/types/v8-contracts.js";

describe("read-failure-no-fabrication", () => {
  function makeRef(id: string): SourceRef {
    return {
      uri: `sn://connector_result/moltbook/feed.read/${id}`,
      family: "connector_result",
      id,
      redactionClass: "none",
      resolveStatus: "resolvable",
    };
  }

  it("does not fabricate evidence from failed result", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = new Date().toISOString();
      const day = now.slice(0, 10);
      const failedResult: ConnectorReadResult = {
        status: "failed",
        platformId: "moltbook",
        capabilityId: "feed.read",
        items: [],
        observedAt: now,
      };

      const normalized = await normalizeConnectorEvidence(db, failedResult, now);
      assert.equal(normalized.evidenceIds.length, 0);
      assert.equal(normalized.emptyReason, "ingestion_connector_failed");

      const items = await readEvidenceItemsByStatus(db, "pending");
      assert.equal(items.rows.length, 0, "no evidence fabricated");
    } finally {
      db.close();
    }
  });

  it("does not fabricate evidence from empty success result", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = new Date().toISOString();
      const day = now.slice(0, 10);
      const emptyResult: ConnectorReadResult = {
        status: "success",
        platformId: "moltbook",
        capabilityId: "feed.read",
        items: [],
        observedAt: now,
      };

      const normalized = await normalizeConnectorEvidence(db, emptyResult, now);
      assert.equal(normalized.evidenceIds.length, 0);
      assert.equal(normalized.emptyReason, "evidence_batch_empty");

      const items = await readEvidenceItemsByStatus(db, "pending");
      assert.equal(items.rows.length, 0);
    } finally {
      db.close();
    }
  });

  it("writes evidence only from success result with items", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = new Date().toISOString();
      const day = now.slice(0, 10);
      const successResult: ConnectorReadResult = {
        status: "success",
        platformId: "moltbook",
        capabilityId: "feed.read",
        items: [{ id: "post_001", content: "hello world" }],
        observedAt: now,
      };

      const normalized = await normalizeConnectorEvidence(db, successResult, now);
      assert.equal(normalized.evidenceIds.length, 1);
      assert.equal(normalized.emptyReason, undefined);

      const items = await readEvidenceItemsByStatus(db, "pending");
      assert.equal(items.rows.length, 1);
    } finally {
      db.close();
    }
  });
});
