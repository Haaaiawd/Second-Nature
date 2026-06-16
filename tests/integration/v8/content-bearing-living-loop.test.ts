/**
 * INT-R4: Content-Bearing Living Loop — Integration Gate
 *
 * Validates: heartbeat with a connector-style evidence payload produces
 * content-bearing EvidenceItem → PerceptionCard with readable summary →
 → daily rhythm advances Quiet completed → Dream executed to completed.
 * Ensures no ref-only shells or stuck scheduled states.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import {
  writeEvidenceItem,
  readEvidenceItemById,
  readPerceptionCardsByCycle,
  readActionClosuresByCycle,
  readQuietDailyReviewById,
  readDreamConsolidationRunById,
  readMemoryProjectionsByStatus,
  readDailyRhythmStateByDay,
} from "../../../src/storage/v8-state-stores.js";
import { runHeartbeatCycle } from "../../../src/core/second-nature/control-plane/heartbeat-orchestrator.js";
import type { SourceRef } from "../../../src/shared/types/v8-contracts.js";

function makeRef(id: string, family: import("../../../src/shared/types/v8-contracts.js").SourceRefFamily = "evidence"): SourceRef {
  return {
    uri: `sn://${family}/${id}`,
    family,
    id,
    redactionClass: "none",
    resolveStatus: "resolvable",
  };
}

function makeContentPayload(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    sourceKind: "connector_payload",
    platformId: "moltbook",
    capabilityId: "feed.read",
    externalId: "post_001",
    observedAt: new Date().toISOString(),
    summaryProducer: "connector_rules",
    title: "Team standup notes",
    summary: "Discussed roadmap priorities and agreed on Q3 focus for Second Nature memory loop.",
    excerpt: "Roadmap priorities: memory loop, content-bearing evidence, Quiet/Dream rhythm.",
    entities: ["memory", "roadmap", "Second Nature"],
    tags: ["standup", "planning"],
    actor: { displayName: "Nyx", platformUserId: "nyx_ha" },
  };
}

describe("INT-R4: content-bearing living loop", () => {
  it("evidence carries readable content after ingestion", async () => {
    const db = createStateDatabase(":memory:");
    try {
      await writeEvidenceItem(db, {
        id: "ev_cb_001",
        createdAt: new Date().toISOString(),
        platformId: "moltbook",
        contentHash: "cb_hash_001",
        observedAt: new Date().toISOString(),
        sourceRefs: [makeRef("ev_cb_001")],
        redactionClass: "none",
        lifecycleStatus: "pending",
        payloadJson: JSON.stringify(makeContentPayload()),
      });

      const row = await readEvidenceItemById(db, "ev_cb_001");
      if ("status" in row) {
        assert.fail("evidence read should not degrade");
      }
      assert.ok(row.row, "evidence row exists");
      const payload = JSON.parse(row.row!.payloadJson ?? "{}");
      assert.ok(payload.summary && String(payload.summary).length > 20, "evidence summary is readable");
    } finally {
      db.close();
    }
  });

  it("heartbeat produces perception card with non-template summary", async () => {
    const db = createStateDatabase(":memory:");
    try {
      await writeEvidenceItem(db, {
        id: "ev_cb_002",
        createdAt: new Date().toISOString(),
        platformId: "moltbook",
        contentHash: "cb_hash_002",
        observedAt: new Date().toISOString(),
        sourceRefs: [makeRef("ev_cb_002")],
        redactionClass: "none",
        lifecycleStatus: "pending",
        payloadJson: JSON.stringify(makeContentPayload()),
      });

      const result = await runHeartbeatCycle(db, {
        workspaceRoot: "/test",
        requestedAt: new Date().toISOString(),
        trigger: "manual",
      });

      const r = result as { cycleId: string; cycleSequence: number };
      const perceptions = await readPerceptionCardsByCycle(db, r.cycleId);
      assert.ok(perceptions.rows.length > 0, "perception card produced");
      const card = perceptions.rows[0];
      assert.ok(card.summary, "card has summary");
      assert.ok(
        !card.summary.includes("_observation") && !card.summary.includes("Ref-only"),
        `summary should be content-bearing, got: ${card.summary}`
      );
    } finally {
      db.close();
    }
  });

  it("heartbeat advances closure → Quiet completed → Dream completed", async () => {
    const db = createStateDatabase(":memory:");
    try {
      await writeEvidenceItem(db, {
        id: "ev_cb_003",
        createdAt: new Date().toISOString(),
        platformId: "moltbook",
        contentHash: "cb_hash_003",
        observedAt: new Date().toISOString(),
        sourceRefs: [makeRef("ev_cb_003")],
        redactionClass: "none",
        lifecycleStatus: "pending",
        payloadJson: JSON.stringify(makeContentPayload()),
      });

      const result = await runHeartbeatCycle(db, {
        workspaceRoot: "/test",
        requestedAt: new Date().toISOString(),
        trigger: "manual",
      });

      const r = result as { cycleId: string };
      const closures = await readActionClosuresByCycle(db, r.cycleId);
      assert.equal(closures.rows.length, 1, "exactly one closure");

      const day = new Date().toISOString().slice(0, 10);
      const rhythm = await readDailyRhythmStateByDay(db, day);
      assert.ok(!rhythm.degraded, "rhythm read ok");
      assert.ok(rhythm.row, "rhythm row exists");
      assert.equal(rhythm.row!.quietStatus, "completed", "Quiet completed");
      assert.equal(rhythm.row!.dreamStatus, "completed", "Dream completed (not stuck scheduled)");

      const quiet = await readQuietDailyReviewById(db, `quiet_${day}`);
      assert.ok(quiet.row, "QuietDailyReview written");
      const quietPayload = JSON.parse(quiet.row!.payloadJson ?? "{}");
      assert.ok(quietPayload.sections, "Quiet review has readable sections");

      const rhythmPayload = JSON.parse(rhythm.row!.payloadJson ?? "{}");
      const dreamRunId = (rhythmPayload.dreamRunIds as string[] | undefined)?.[0];
      assert.ok(dreamRunId, "dream run id recorded in rhythm payload");
      const dream = await readDreamConsolidationRunById(db, dreamRunId);
      assert.ok(dream.row, "DreamConsolidationRun exists");
      assert.equal(dream.row!.status, "completed", "Dream run completed");

      const projections = await readMemoryProjectionsByStatus(db, "active");
      assert.ok(projections.rows.length > 0, "long-term memory projections auto-accepted as active");
    } finally {
      db.close();
    }
  });

  it("UUID-bearing evidence persists without triggering false secret rejection", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      await writeEvidenceItem(db, {
        id: `ev_uuid_${uuid}`,
        createdAt: new Date().toISOString(),
        platformId: "moltbook",
        contentHash: "uuid_hash_001",
        observedAt: new Date().toISOString(),
        sourceRefs: [makeRef(uuid)],
        redactionClass: "none",
        lifecycleStatus: "pending",
        payloadJson: JSON.stringify(makeContentPayload()),
      });

      const row = await readEvidenceItemById(db, `ev_uuid_${uuid}`);
      if ("status" in row) {
        assert.fail("UUID evidence read should not degrade");
      }
      assert.ok(row.row, "UUID-bearing evidence persisted");
    } finally {
      db.close();
    }
  });
});
