/**
 * v9 SelfContinuityCard assembler — Unit Tests (T5.2.2).
 *
 * Validates: canonical section ordering, 1200-byte budget, source ref
 * aggregation, unavailable path, and persistence round-trip.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { createStateDatabase } from "../../../src/storage/db/index.js";
import { writeLongTermMemoryProjection } from "../../../src/storage/v8-state-stores.js";
import type { SourceRef as V8SourceRef } from "../../../src/shared/types/v8-contracts.js";
import type { SourceRef, SourceRefFamily } from "../../../src/shared/types/v9-contracts.js";
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

describe("v9-self-continuity-card-assembler", () => {
  it("returns unavailable when no continuity data exists", async () => {
    const db = createStateDatabase(":memory:");
    const result = await assembleSelfContinuityCard(db, { workspaceRoot: "/tmp/ws" });
    assert.ok("operatorNextAction" in result);
    assert.equal((result as any).reason, "continuity_unavailable");
  });

  it("assembles card with canonical section ordering and bounded text", async () => {
    const db = createStateDatabase(":memory:");
    await writeLongTermMemoryProjection(db, makeMemoryProjection("mem-1", [makeSourceRef("evidence", "ev1")]));
    await writeToolRoutine(db, makeToolRoutine("rt-1", [makeSourceRef("action", "act1")]));

    const result = await assembleSelfContinuityCard(db, { workspaceRoot: "/tmp/ws", now: NOW });
    assert.ok("card" in result);
    const { card } = result as { card: import("../../../src/shared/types/v9-contracts.js").SelfContinuityCard };

    assert.equal(card.status, "active");
    assert.ok(card.summary.length > 0);
    assert.ok(card.bodyIntuition.length > 0);
    assert.ok(card.relationshipPosture.length > 0);
    assert.ok(card.valuePosture.length > 0);
    assert.equal(card.behaviorHabits.length, 1);
    assert.equal(card.activeRoutinePointers.length, 1);
    assert.equal(card.currentProhibitions.length, 2);
    assert.equal(card.characterFramePointer.status, "deferred");
    assert.ok(card.sourceRefs.length >= 1);

    const { row } = await import("../../../src/storage/v9-state-stores.js").then((m) =>
      m.readSelfContinuityCardById(db, card.id),
    );
    assert.ok(row);
    const text = row!.cardText;
    assert.ok(text.startsWith("Summary:"));
    assert.ok(text.indexOf("Body intuition:") > text.indexOf("Summary:"));
    assert.ok(text.indexOf("Relationship:") > text.indexOf("Body intuition:"));
    assert.ok(text.indexOf("Values:") > text.indexOf("Relationship:"));
    assert.ok(text.indexOf("Habits:") > text.indexOf("Values:"));
    assert.ok(text.indexOf("Active routines:") > text.indexOf("Habits:"));
    assert.ok(text.indexOf("Prohibitions:") > text.indexOf("Active routines:"));
    assert.ok(text.indexOf("[character frame pointer]") > text.indexOf("Prohibitions:"));

    assert.equal(card.summary, "continuity summary: 1 active memory projection(s)");
    assert.ok(Array.from(card.summary).length <= 120);
    assert.ok(Array.from(card.bodyIntuition).length <= 200);
    assert.ok(Array.from(card.relationshipPosture).length <= 200);
    assert.ok(Array.from(card.valuePosture).length <= 200);
  });

  it("includes CharacterFrame pointer when accepted frame exists", async () => {
    const db = createStateDatabase(":memory:");
    await writeCharacterFrame(db, makeCharacterFrame("frame-1", [makeSourceRef("character", "char1")]));

    const result = await assembleSelfContinuityCard(db, { workspaceRoot: "/tmp/ws", now: NOW });
    assert.ok("card" in result);
    const { card } = result as { card: import("../../../src/shared/types/v9-contracts.js").SelfContinuityCard };

    assert.equal(card.characterFramePointer.frameId, "frame-1");
    assert.equal(card.characterFramePointer.status, "active");
    assert.ok(card.sourceRefs.some((r) => r.family === "character"));
  });

  it("aggregates source refs across families", async () => {
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
    await writeCharacterFrame(db, makeCharacterFrame("frame-1", [makeSourceRef("character", "char1")]));

    const result = await assembleSelfContinuityCard(db, { workspaceRoot: "/tmp/ws", now: NOW });
    assert.ok("card" in result);
    const { card } = result as { card: import("../../../src/shared/types/v9-contracts.js").SelfContinuityCard };

    const families = new Set(card.sourceRefs.map((r) => r.family));
    assert.ok(families.has("evidence"), `expected evidence in ${[...families].join(",")}`);
    assert.ok(families.has("routine"));
    assert.ok(families.has("action"));
    assert.ok(families.has("character"));
  });

  it("truncates card text to 1200 UTF-8 chars", async () => {
    const db = createStateDatabase(":memory:");
    // Seed many long routines to force budget trimming.
    for (let i = 0; i < 30; i++) {
      await writeToolRoutine(
        db,
        makeToolRoutine(`rt-long-${i}`, [makeSourceRef("action", `act${i}`)]),
      );
    }

    const result = await assembleSelfContinuityCard(db, { workspaceRoot: "/tmp/ws", now: NOW });
    assert.ok("card" in result);
    const { persistedId } = result as { persistedId: string };

    const { row } = await import("../../../src/storage/v9-state-stores.js").then((m) =>
      m.readSelfContinuityCardById(db, persistedId),
    );
    assert.ok(row);
    assert.ok(countChars(row!.cardText) <= 1200, `cardText chars ${countChars(row!.cardText)}`);
    const text = row!.cardText;
    assert.ok(text.indexOf("Summary:") >= 0);
    assert.ok(text.indexOf("[character frame pointer]") >= 0);
  });

  it("redacts credential-like content from card text", async () => {
    const db = createStateDatabase(":memory:");
    await writeToolRoutine(
      db,
      makeToolRoutine("rt-credential", [makeSourceRef("action", "act-cred")]),
    );
    // Patch the in-memory routine row to inject a credential-shaped name.
    const dbInner = db.db;
    const { toolRoutine } = await import("../../../src/storage/db/schema/v9-entities.js");
    const { eq } = await import("drizzle-orm");
    await dbInner.update(toolRoutine)
      .set({ capabilityPattern: "sk-abcdefghijklmnopqrstuvwxyz123456" })
      .where(eq(toolRoutine.id, "rt-credential"));

    const result = await assembleSelfContinuityCard(db, { workspaceRoot: "/tmp/ws", now: NOW });
    assert.ok("card" in result);
    const { card } = result as { card: import("../../../src/shared/types/v9-contracts.js").SelfContinuityCard };

    const { row } = await import("../../../src/storage/v9-state-stores.js").then((m) =>
      m.readSelfContinuityCardById(db, card.id),
    );
    assert.ok(row);
    assert.ok(!row!.cardText.includes("sk-abcdefghijklmnopqrstuvwxyz123456"));
    assert.ok(row!.cardText.includes("[REDACTED]"));
    assert.ok(row!.redactionClass === "redacted" || card.redactionClass === "redacted");
  });

  it("ContinuityReadPort returns latest active card without re-assembly", async () => {
    const db = createStateDatabase(":memory:");
    await writeLongTermMemoryProjection(db, makeMemoryProjection("mem-1", [makeSourceRef("evidence", "ev1")]));

    const first = await assembleSelfContinuityCard(db, { workspaceRoot: "/tmp/ws", now: NOW });
    assert.ok("card" in first);

    const port = createContinuityReadPort(db);
    const loaded = await port.loadSelfContinuityCard({ workspaceRoot: "/tmp/ws" });
    assert.ok("summary" in loaded);
    assert.equal((loaded as any).id, (first as any).persistedId);
  });
});
