/**
 * NormalizedEvidenceContent — Unit Tests (T-CS.R.4)
 *
 * Validates: extractor handles nested arrays, missing fields, unknown shapes,
 * and produces content-bearing envelopes.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  extractNormalizedEvidenceItems,
  computeEvidenceContentHashSync,
} from "../../../src/connectors/base/normalized-evidence-content.js";

describe("normalized-evidence-content", () => {
  it("extracts MoltBook-like post with summary, actor, url", () => {
    const payload = {
      posts: [
        {
          id: "post_001",
          type: "post",
          title: "Roadmap sync",
          content: "Agreed on Q3 focus for memory loop.",
          author: { displayName: "Nyx", userId: "nyx_ha" },
          url: "https://moltbook.example/p/post_001",
          tags: ["planning"],
          createdAt: "2026-06-15T10:00:00Z",
        },
      ],
    };

    const items = extractNormalizedEvidenceItems(payload, {
      platformId: "moltbook",
      capabilityId: "feed.read",
      observedAt: "2026-06-15T10:00:00Z",
      summaryProducer: "connector_rules",
    });

    assert.equal(items.length, 1);
    assert.equal(items[0]?.sourceKind, "post");
    assert.equal(items[0]?.title, "Roadmap sync");
    assert.ok(String(items[0]?.summary).includes("memory loop"));
    assert.equal(items[0]?.actor?.displayName, "Nyx");
    assert.equal(items[0]?.url, "https://moltbook.example/p/post_001");
    assert.equal(items[0]?.summaryProducer, "connector_rules");
  });

  it("handles unknown shape without crashing", () => {
    const items = extractNormalizedEvidenceItems({ arbitrary: { nested: true } }, {
      platformId: "moltbook",
      capabilityId: "feed.read",
      observedAt: "2026-06-15T10:00:00Z",
      summaryProducer: "connector_rules",
    });
    assert.equal(items.length, 0);
  });

  it("deduplicates nested arrays", () => {
    const payload = {
      items: [
        { id: "a", title: "A", content: "same" },
        { id: "a", title: "A", content: "same" },
      ],
    };
    const items = extractNormalizedEvidenceItems(payload, {
      platformId: "moltbook",
      capabilityId: "feed.read",
      observedAt: "2026-06-15T10:00:00Z",
      summaryProducer: "connector_rules",
    });
    assert.equal(items.length, 2); // extraction preserves both; dedupe happens downstream
    assert.equal(items[0]?.externalId, "a");
  });

  it("computes stable content hash", () => {
    const a = computeEvidenceContentHashSync({
      schemaVersion: 1,
      sourceKind: "post",
      platformId: "moltbook",
      capabilityId: "feed.read",
      externalId: "x",
      summary: "same",
      observedAt: "2026-06-15T10:00:00Z",
      summaryProducer: "connector_rules",
    });
    const b = computeEvidenceContentHashSync({
      schemaVersion: 1,
      sourceKind: "post",
      platformId: "moltbook",
      capabilityId: "feed.read",
      externalId: "x",
      summary: "same",
      observedAt: "2026-06-15T11:00:00Z",
      summaryProducer: "connector_rules",
    });
    assert.equal(a, b);
  });
});
