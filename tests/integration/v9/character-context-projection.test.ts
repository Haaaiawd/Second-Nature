/**
 * v9 CharacterFrame context projection integration test (T7.2.2).
 *
 * Verifies that accepted CharacterFrame rows can be loaded as pointer +
 * projection pairs, contested frames degrade gracefully, and schema columns
 * round-trip through the state database.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { createStateDatabase } from "../../../src/storage/db/index.js";
import {
  writeCharacterFrame,
  readCharacterFrameById,
  readLatestAcceptedCharacterFrame,
  readCharacterFrameRevisionCandidates,
} from "../../../src/storage/v9-state-stores.js";
import {
  applyCharacterContest,
  buildCharacterProjectionPair,
  loadActiveCharacterFrame,
  type CharacterFrameStorePort,
} from "../../../src/core/second-nature/character/character-frame-lifecycle.js";
import type { CharacterFrame } from "../../../src/shared/types/v9-contracts.js";

const NOW = new Date("2026-06-26T10:00:00Z").toISOString();

function makeFrame(overrides: Partial<CharacterFrame> = {}): CharacterFrame {
  return {
    id: "frame-1",
    projectionKind: "character_frame",
    version: 1,
    status: "accepted",
    validFrom: NOW,
    validUntil: null,
    charCount: 200,
    sourceRefs: [{ family: "evidence", id: "ev1" }],
    emergentHabits: [
      { description: "morning feed read", sourceRefs: [{ family: "evidence", id: "ev1" }], confidence: "medium" },
    ],
    valuePosture: { ordering: ["clarity"], sourceRefs: [{ family: "evidence", id: "ev1" }] },
    relationshipPosture: {
      toward: "owner:haa",
      stance: "responsive and observation-oriented",
      sourceRefs: [{ family: "evidence", id: "ev1" }],
    },
    expressionPosture: {
      styleNotes: ["concise"],
      boundaryConstraints: ["avoid claiming emotion as fact"],
      sourceRefs: [{ family: "evidence", id: "ev1" }],
    },
    contestPrompt: "This is a contestable projection.",
    supersededBy: null,
    revisionOf: null,
    createdAt: NOW,
    acceptedAt: NOW,
    ...overrides,
  };
}

function makeDbStore(db: ReturnType<typeof createStateDatabase>): CharacterFrameStorePort {
  return {
    async readFrameById(id: string) {
      const row = await readCharacterFrameById(db, id);
      if (!row) return null;
      return rowToFrame(row);
    },
    async readLatestAcceptedFrame() {
      const { row } = await readLatestAcceptedCharacterFrame(db);
      return row ? rowToFrame(row) : null;
    },
    async readPendingRevisionFor(frameId: string) {
      const { rows } = await readCharacterFrameRevisionCandidates(db, frameId);
      return rows[0] ? rowToFrame(rows[0]) : null;
    },
    async writeCandidateFrame(frame: CharacterFrame) {
      await writeCharacterFrame(db, frameToWrite(frame));
    },
    async updateFrameLifecycle(frameId, status, opts) {
      const { eq } = await import("drizzle-orm");
      const schema = db.schema as any;
      await db.db
        .update(schema.characterFrame)
        .set({
          status,
          supersededBy: opts?.supersededBy ?? null,
          validUntil: opts?.validUntil ?? null,
          revisionOf: opts?.revisionOf ?? null,
          acceptedAt: opts?.acceptedAt ?? null,
          charCount: opts?.charCount ?? undefined,
          payloadJson: opts?.payloadJson ?? undefined,
        })
        .where(eq(schema.characterFrame.id, frameId));
    },
  };
}

function rowToFrame(row: any): CharacterFrame {
  return {
    ...row,
    projectionKind: "character_frame",
    sourceRefs: JSON.parse(row.sourceRefsJson),
    emergentHabits: JSON.parse(row.sectionsJson).emergentHabits,
    valuePosture: JSON.parse(row.sectionsJson).valuePosture,
    relationshipPosture: JSON.parse(row.sectionsJson).relationshipPosture,
    expressionPosture: JSON.parse(row.sectionsJson).expressionPosture,
    growthTensions: JSON.parse(row.sectionsJson).growthTensions,
    conflictNotes: JSON.parse(row.sectionsJson).conflictNotes,
    payloadJson: row.payloadJson ?? undefined,
  };
}

function frameToWrite(frame: CharacterFrame): any {
  return {
    id: frame.id,
    createdAt: frame.createdAt,
    version: frame.version,
    validFrom: frame.validFrom,
    status: frame.status,
    sectionsJson: JSON.stringify({
      emergentHabits: frame.emergentHabits,
      valuePosture: frame.valuePosture,
      relationshipPosture: frame.relationshipPosture,
      expressionPosture: frame.expressionPosture,
      growthTensions: frame.growthTensions,
      conflictNotes: frame.conflictNotes,
    }),
    contestPrompt: frame.contestPrompt,
    charCount: frame.charCount,
    sourceRefs: frame.sourceRefs,
    supersededBy: frame.supersededBy,
    revisionOf: frame.revisionOf,
    acceptedAt: frame.acceptedAt,
    validUntil: frame.validUntil,
    payloadJson: frame.payloadJson,
  };
}

describe("INT-T7.2.2 character-context-projection", () => {
  it("loads active accepted frame as pointer + projection pair", async () => {
    const db = createStateDatabase(":memory:");
    const store = makeDbStore(db);
    await store.writeCandidateFrame(makeFrame({ status: "accepted" }));

    const result = await loadActiveCharacterFrame(store, { isFirstInjection: true });
    assert.ok(result.frame);
    assert.equal(result.pointer?.frameId, "frame-1");
    assert.equal(result.pointer?.status, "active");
    assert.equal(result.pointer?.newlyProposed, true);
    assert.equal(result.projection?.status, "active");
    assert.equal(result.projection?.newlyProposed, true);
    assert.ok(new TextEncoder().encode(result.projection?.text ?? "").length <= 900);
    assert.ok(new TextEncoder().encode(result.pointer?.summary ?? "").length <= 200);
  });

  it("returns deferred when latest frame is rejected", async () => {
    const db = createStateDatabase(":memory:");
    const store = makeDbStore(db);
    await store.writeCandidateFrame(makeFrame({ status: "rejected" }));

    const result = await loadActiveCharacterFrame(store);
    assert.equal(result.reason, "character_frame_deferred");
    assert.equal(result.frame, undefined);
  });

  it("returns contested projection when contestedFrameId matches", async () => {
    const db = createStateDatabase(":memory:");
    const store = makeDbStore(db);
    await store.writeCandidateFrame(makeFrame());

    const result = await loadActiveCharacterFrame(store, { contestedFrameId: "frame-1" });
    assert.equal(result.projection?.status, "contested");
    assert.equal(result.reason, "character_frame_contested");
  });

  it("reject action persists and blocks active injection", async () => {
    const db = createStateDatabase(":memory:");
    const store = makeDbStore(db);
    await store.writeCandidateFrame(makeFrame());

    const contest = await applyCharacterContest("frame-1", "reject", store, { now: NOW });
    assert.equal(contest.newStatus, "rejected");

    const result = await loadActiveCharacterFrame(store);
    assert.equal(result.reason, "character_frame_deferred");
  });

  it("buildCharacterProjectionPair serializes within budgets", () => {
    const frame = makeFrame({
      emergentHabits: Array.from({ length: 10 }, (_, i) => ({
        description: `habit ${i}: `.repeat(50),
        sourceRefs: [{ family: "evidence", id: `ev${i}` }],
        confidence: "medium" as const,
      })),
    });
    const { pointer, projection } = buildCharacterProjectionPair(frame);
    assert.ok(new TextEncoder().encode(pointer.summary).length <= 200);
    assert.ok(new TextEncoder().encode(projection.text).length <= 900);
  });
});
