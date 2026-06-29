/**
 * v9 SelfContinuityCard read integration test (T5.2.2).
 *
 * Validates persistence round-trip, `ContinuityReadPort.loadSelfContinuityCard`
 * cache hit/miss, and `continuity_unavailable` degraded path.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { createStateDatabase } from "../../../src/storage/db/index.js";
import { writeLongTermMemoryProjection } from "../../../src/storage/v8-state-stores.js";
import {
  writeToolRoutine,
  writeProceduralProjection,
  writeCharacterFrame,
} from "../../../src/storage/v9-state-stores.js";
import {
  assembleSelfContinuityCard,
  createContinuityReadPort,
  countChars,
} from "../../../src/core/second-nature/memory/self-continuity-card-assembler.js";
import type { SourceRef as V8SourceRef } from "../../../src/shared/types/v8-contracts.js";
import type { SourceRef, SourceRefFamily } from "../../../src/shared/types/v9-contracts.js";

const NOW = new Date("2026-06-26T10:00:00Z").toISOString();

function makeSourceRef(family: SourceRefFamily, id: string): SourceRef {
  return { family, id };
}

function toV8SourceRefs(refs: SourceRef[]): V8SourceRef[] {
  return refs.map((r) => ({
    uri: `${r.family}:${r.id}`,
    family: r.family as V8SourceRef["family"],
    id: r.id,
    redactionClass: "none" as const,
    sensitivityClass: "public_general" as const,
  }));
}

function makeMemoryProjection(id: string, sourceRefs: SourceRef[]) {
  return {
    id,
    createdAt: NOW,
    candidateId: `cand_${id}`,
    topicKey: "topic_1",
    status: "active" as const,
    sourceRefs: toV8SourceRefs(sourceRefs),
    payloadJson: JSON.stringify({ memoryText: `memory ${id}` }),
  };
}

function makeToolRoutine(id: string, sourceRefs: SourceRef[]) {
  return {
    id,
    name: `routine ${id}`,
    version: "1.0.0",
    capabilityPattern: `moltbook:feed.${id}`,
    status: "active" as const,
    sourceRefs,
    payloadJson: JSON.stringify({ triggerConditions: {}, steps: [] }),
    createdAt: NOW,
  };
}

function makeCharacterFrame(id: string, sourceRefs: SourceRef[]) {
  return {
    id,
    projectionKind: "character_frame" as const,
    version: 1,
    status: "accepted" as const,
    validFrom: NOW,
    validUntil: null,
    charCount: 200,
    sourceRefs,
    sectionsJson: JSON.stringify({
      emergentHabits: [{ description: "morning feed read", sourceRefs, confidence: "medium" }],
      valuePosture: { ordering: ["clarity"], sourceRefs },
      relationshipPosture: { toward: "owner:haa", stance: "responsive", sourceRefs },
      expressionPosture: { styleNotes: ["concise"], boundaryConstraints: ["avoid claiming emotion"], sourceRefs },
      growthTensions: [],
      conflictNotes: [],
    }),
    contestPrompt: "This is contestable.",
    supersededBy: null,
    revisionOf: null,
    createdAt: NOW,
    acceptedAt: NOW,
  };
}

describe("v9-self-continuity-card-read", () => {
  it("assembles and persists a card when no active card exists", async () => {
    const db = createStateDatabase(":memory:");
    await writeLongTermMemoryProjection(db, makeMemoryProjection("mem-1", [makeSourceRef("evidence", "ev1")]));
    await writeToolRoutine(db, makeToolRoutine("rt-1", [makeSourceRef("action", "act1")]));
    await writeCharacterFrame(db, makeCharacterFrame("frame-1", [makeSourceRef("character", "char1")]));

    const port = createContinuityReadPort(db);
    const result = await port.loadSelfContinuityCard({ workspaceRoot: "/tmp/ws", now: NOW });

    assert.ok("summary" in result);
    const card = result as import("../../../src/shared/types/v9-contracts.js").SelfContinuityCard;
    assert.equal(card.status, "active");
    assert.ok(card.characterFramePointer.status === "active");
    assert.ok(card.sourceRefs.length >= 3);
  });

  it("returns the latest active card without re-assembly", async () => {
    const db = createStateDatabase(":memory:");
    await writeLongTermMemoryProjection(db, makeMemoryProjection("mem-1", [makeSourceRef("evidence", "ev1")]));

    const first = await assembleSelfContinuityCard(db, { workspaceRoot: "/tmp/ws", now: NOW });
    assert.ok("card" in first);

    const port = createContinuityReadPort(db);
    const loaded = await port.loadSelfContinuityCard({ workspaceRoot: "/tmp/ws", now: NOW });
    assert.ok("summary" in loaded);
    assert.equal((loaded as any).id, (first as any).persistedId);
  });

  it("returns continuity_unavailable when no continuity data exists", async () => {
    const db = createStateDatabase(":memory:");
    const port = createContinuityReadPort(db);
    const result = await port.loadSelfContinuityCard({ workspaceRoot: "/tmp/ws", now: NOW });

    assert.ok("operatorNextAction" in result);
    assert.equal((result as any).reason, "continuity_unavailable");
  });

  it("loads routine list and active projections through ContinuityReadPort", async () => {
    const db = createStateDatabase(":memory:");
    await writeLongTermMemoryProjection(db, makeMemoryProjection("mem-1", [makeSourceRef("evidence", "ev1")]));
    await writeProceduralProjection(db, {
      id: "proc-1",
      createdAt: NOW,
      candidateId: "cand-proc-1",
      capabilityPattern: "moltbook:feed.read",
      status: "installed",
      sourceRefs: [makeSourceRef("routine", "rt1")],
      payloadJson: JSON.stringify({ routineDefinition: {} }),
    });
    await writeToolRoutine(db, makeToolRoutine("rt-1", [makeSourceRef("action", "act1")]));

    const port = createContinuityReadPort(db);

    const routines = await port.loadRoutineList({ workspaceRoot: "/tmp/ws" });
    assert.equal(routines.routines.length, 1);
    assert.equal(routines.routines[0].status, "installed");

    const memories = await port.loadActiveMemoryProjections({ workspaceRoot: "/tmp/ws" });
    assert.equal(memories.projections.length, 1);

    const procedurals = await port.loadActiveProceduralProjections({ workspaceRoot: "/tmp/ws" });
    assert.equal(procedurals.projections.length, 1);
  });

  it("honors the 1200 character cardText budget", async () => {
    const db = createStateDatabase(":memory:");
    for (let i = 0; i < 30; i++) {
      await writeToolRoutine(db, makeToolRoutine(`rt-long-${i}`, [makeSourceRef("action", `act${i}`)]));
    }

    const port = createContinuityReadPort(db);
    const result = await port.loadSelfContinuityCard({ workspaceRoot: "/tmp/ws", now: NOW });
    assert.ok("summary" in result);

    const { row } = await import("../../../src/storage/v9-state-stores.js").then((m) =>
      m.readLatestSelfContinuityCard(db),
    );
    assert.ok(row);
    assert.ok(countChars(row!.cardText) <= 1200, `cardText chars ${countChars(row!.cardText)}`);
  });
});
