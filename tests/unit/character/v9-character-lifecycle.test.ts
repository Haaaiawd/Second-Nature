/**
 * v9 CharacterFrame lifecycle — Unit Tests
 *
 * Validates: transition matrix, illegal actions, revision candidate creation,
 * projection/pointer builders, active frame loader, first-injection flag.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  applyCharacterContest,
  buildCharacterFramePointer,
  buildEmbodiedContextProjection,
  loadActiveCharacterFrame,
  markFirstInjectionSeen,
  supersedeFrame,
  type CharacterFrameStorePort,
} from "../../../src/core/second-nature/character/character-frame-lifecycle.js";
import type { CharacterFrame } from "../../../src/shared/types/v9-contracts.js";

const now = "2026-06-26T00:00:00Z";

function makeFrame(overrides: Partial<CharacterFrame> = {}): CharacterFrame {
  return {
    id: "frame_1",
    projectionKind: "character_frame",
    version: 1,
    status: "accepted",
    validFrom: now,
    validUntil: null,
    charCount: 120,
    sourceRefs: [{ family: "evidence", id: "ev1" }],
    emergentHabits: [
      { description: "reads feed in the morning", sourceRefs: [{ family: "evidence", id: "ev1" }], confidence: "medium" },
    ],
    valuePosture: { ordering: ["clarity", "care"], sourceRefs: [{ family: "evidence", id: "ev1" }] },
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
    contestPrompt: "This is contestable.",
    supersededBy: null,
    revisionOf: null,
    createdAt: now,
    ...overrides,
  };
}

function makeMemoryStore(initial: CharacterFrame[] = []): CharacterFrameStorePort {
  const frames = new Map<string, CharacterFrame>(initial.map((f) => [f.id, { ...f }]));
  return {
    async readFrameById(id: string) {
      const frame = frames.get(id);
      return frame ? { ...frame } : null;
    },
    async readLatestAcceptedFrame() {
      const accepted = Array.from(frames.values())
        .filter((f) => f.status === "accepted")
        .sort((a, b) => new Date(b.acceptedAt ?? b.createdAt).getTime() - new Date(a.acceptedAt ?? a.createdAt).getTime());
      return accepted[0] ? { ...accepted[0] } : null;
    },
    async readPendingRevisionFor(frameId: string) {
      const candidates = Array.from(frames.values())
        .filter((f) => f.status === "candidate" && f.revisionOf === frameId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return candidates[0] ? { ...candidates[0] } : null;
    },
    async writeCandidateFrame(frame: CharacterFrame) {
      frames.set(frame.id, { ...frame });
    },
    async updateFrameLifecycle(
      frameId: string,
      status: CharacterFrame["status"],
      opts?: {
        supersededBy?: string;
        successorFrameId?: string;
        validUntil?: string;
        revisionOf?: string | null;
        acceptedAt?: string;
        charCount?: number;
        payloadJson?: string;
      },
    ) {
      const frame = frames.get(frameId);
      if (!frame) throw new Error("frame_not_found");
      frame.status = status;
      if (opts?.supersededBy !== undefined) frame.supersededBy = opts.supersededBy;
      if (opts?.validUntil !== undefined) frame.validUntil = opts.validUntil;
      if (opts?.revisionOf !== undefined) frame.revisionOf = opts.revisionOf;
      if (opts?.acceptedAt !== undefined) frame.acceptedAt = opts.acceptedAt;
      if (opts?.charCount !== undefined) frame.charCount = opts.charCount;
      if (opts?.payloadJson !== undefined) frame.payloadJson = opts.payloadJson;
    },
  };
}

describe("v9-character-frame-lifecycle", () => {
  it("rejects illegal contest transitions", async () => {
    const store = makeMemoryStore([makeFrame({ status: "rejected" })]);
    await assert.rejects(
      () => applyCharacterContest("frame_1", "retire", store, { now }),
      /invalid_contest_action/,
    );
  });

  it("rejects contest on superseded frame", async () => {
    const store = makeMemoryStore([makeFrame({ status: "superseded" })]);
    await assert.rejects(
      () => applyCharacterContest("frame_1", "reject", store, { now }),
      /invalid_contest_action/,
    );
  });

  it("reject transitions accepted -> rejected and sets validUntil", async () => {
    const store = makeMemoryStore([makeFrame({ status: "accepted" })]);
    const result = await applyCharacterContest("frame_1", "reject", store, { now });
    assert.equal(result.previousStatus, "accepted");
    assert.equal(result.newStatus, "rejected");
    assert.equal(result.sourceRefs[0]?.family, "character");

    const frame = await store.readFrameById("frame_1");
    assert.equal(frame?.validUntil, now);
  });

  it("retire transitions accepted -> retired and sets validUntil", async () => {
    const store = makeMemoryStore([makeFrame({ status: "accepted" })]);
    const result = await applyCharacterContest("frame_1", "retire", store, { now });
    assert.equal(result.newStatus, "retired");

    const frame = await store.readFrameById("frame_1");
    assert.equal(frame?.validUntil, now);
  });

  it("revise creates a candidate successor while original stays accepted", async () => {
    const store = makeMemoryStore([makeFrame({ status: "accepted" })]);
    const result = await applyCharacterContest("frame_1", "revise", store, { now });
    assert.equal(result.previousStatus, "accepted");
    assert.equal(result.newStatus, "accepted");
    assert.ok(result.successorFrameId);

    const original = await store.readFrameById("frame_1");
    assert.equal(original?.status, "accepted");

    const revision = await store.readFrameById(result.successorFrameId!);
    assert.equal(revision?.status, "candidate");
    assert.equal(revision?.revisionOf, "frame_1");
    assert.equal(revision?.version, 2);
  });

  it("accept transitions candidate -> accepted and sets acceptedAt", async () => {
    const store = makeMemoryStore([makeFrame({ status: "candidate" })]);
    const result = await applyCharacterContest("frame_1", "accept", store, { now });
    assert.equal(result.newStatus, "accepted");

    const frame = await store.readFrameById("frame_1");
    assert.equal(frame?.acceptedAt, now);
  });

  it("accepting a revision supersedes the original frame", async () => {
    const store = makeMemoryStore([
      makeFrame({ id: "original", status: "accepted" }),
      makeFrame({ id: "revision", status: "candidate", revisionOf: "original" }),
    ]);
    const result = await applyCharacterContest("revision", "accept", store, { now });
    assert.equal(result.newStatus, "accepted");

    const original = await store.readFrameById("original");
    assert.equal(original?.status, "superseded");
    assert.equal(original?.supersededBy, "revision");
    assert.equal(original?.validUntil, now);
  });

  it("supersedeFrame marks previous accepted frame as superseded", async () => {
    const store = makeMemoryStore([makeFrame({ status: "accepted" })]);
    const result = await supersedeFrame("frame_1", "frame_2", store, { now });
    assert.equal(result.previousStatus, "accepted");
    assert.equal(result.newStatus, "superseded");

    const frame = await store.readFrameById("frame_1");
    assert.equal(frame?.supersededBy, "frame_2");
    assert.equal(frame?.validUntil, now);
  });

  it("builds pointer with summary ≤200 chars", () => {
    const frame = makeFrame({
      emergentHabits: Array.from({ length: 10 }, (_, i) => ({
        description: `habit number ${i} with a very long description that should be truncated`,
        sourceRefs: [{ family: "evidence", id: `ev${i}` }],
        confidence: "medium" as const,
      })),
    });
    const pointer = buildCharacterFramePointer(frame);
    assert.equal(pointer.frameId, "frame_1");
    assert.ok(pointer.summary.length > 0);
    assert.ok(new TextEncoder().encode(pointer.summary).length <= 200);
    assert.equal(pointer.status, "active");
  });

  it("builds projection text ≤900 chars", () => {
    const frame = makeFrame();
    const projection = buildEmbodiedContextProjection(frame);
    assert.equal(projection.frameId, "frame_1");
    assert.ok(projection.text.length > 0);
    assert.ok(new TextEncoder().encode(projection.text).length <= 900);
    assert.equal(projection.status, "active");
  });

  it("projection status respects contested/deferred", () => {
    const frame = makeFrame();
    const contested = buildEmbodiedContextProjection(frame, { pointerStatus: "contested" });
    assert.equal(contested.status, "contested");
    const deferred = buildEmbodiedContextProjection(frame, { pointerStatus: "deferred" });
    assert.equal(deferred.status, "deferred");
  });

  it("loadActiveCharacterFrame returns newlyProposed on first injection", async () => {
    const store = makeMemoryStore([makeFrame()]);
    const result = await loadActiveCharacterFrame(store, { isFirstInjection: true });
    assert.ok(result.frame);
    assert.equal(result.pointer?.newlyProposed, true);
    assert.equal(result.projection?.newlyProposed, true);
    assert.equal(result.projection?.status, "active");
  });

  it("loadActiveCharacterFrame defaults newlyProposed to false for previously seen frames", async () => {
    const store = makeMemoryStore([makeFrame({ payloadJson: JSON.stringify({ firstInjectedAt: now }) })]);
    const result = await loadActiveCharacterFrame(store);
    assert.equal(result.pointer?.newlyProposed, false);
    assert.equal(result.projection?.newlyProposed, false);
  });

  it("loadActiveCharacterFrame defaults newlyProposed to true for unseen frames", async () => {
    const store = makeMemoryStore([makeFrame()]);
    const result = await loadActiveCharacterFrame(store);
    assert.equal(result.pointer?.newlyProposed, true);
    assert.equal(result.projection?.newlyProposed, true);
  });

  it("loadActiveCharacterFrame returns contested when a revision is pending", async () => {
    const store = makeMemoryStore([
      makeFrame({ id: "original", status: "accepted" }),
      makeFrame({ id: "revision", status: "candidate", revisionOf: "original" }),
    ]);
    const result = await loadActiveCharacterFrame(store);
    assert.equal(result.projection?.status, "contested");
    assert.equal(result.reason, "character_frame_revision_pending");
  });

  it("loadActiveCharacterFrame returns contested when contestedFrameId matches", async () => {
    const store = makeMemoryStore([makeFrame()]);
    const result = await loadActiveCharacterFrame(store, { contestedFrameId: "frame_1" });
    assert.equal(result.projection?.status, "contested");
    assert.equal(result.reason, "character_frame_contested");
  });

  it("loadActiveCharacterFrame returns deferred when no accepted frame", async () => {
    const store = makeMemoryStore();
    const result = await loadActiveCharacterFrame(store);
    assert.equal(result.reason, "character_frame_deferred");
    assert.equal(result.frame, undefined);
  });

  it("markFirstInjectionSeen persists first-injected marker in payloadJson", async () => {
    const store = makeMemoryStore([makeFrame()]);
    await markFirstInjectionSeen(store, "frame_1", now);
    const frame = await store.readFrameById("frame_1");
    assert.ok(frame?.payloadJson);
    const payload = JSON.parse(frame!.payloadJson!);
    assert.equal(payload.firstInjectedAt, now);
  });

  it("projection text self-identifies as contestable", () => {
    const frame = makeFrame();
    const projection = buildEmbodiedContextProjection(frame);
    assert.ok(projection.text.startsWith("[Contestable projection]"));
  });
});
