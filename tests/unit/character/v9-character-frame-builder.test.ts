/**
 * v9 Character Frame Builder — Unit Tests
 *
 * Validates: five-section extraction, source ref grounding, validator
 * integration, auto-supersede, char budget, deferred paths.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  refreshCharacterFrame,
  type CharacterFrameStorePort,
} from "../../../src/core/second-nature/character/character-frame-builder.js";
import type {
  CharacterFrame,
  CharacterRefreshInput,
  CharacterSignal,
} from "../../../src/shared/types/v9-contracts.js";

const now = "2026-06-26T00:00:00Z";

function makeSignal(overrides: Partial<CharacterSignal> = {}): CharacterSignal {
  return {
    signalId: "sig_1",
    signalKind: "tool_experience",
    originSystem: "memory-continuity-system",
    summary: "Repeated successful moltbook feed.read execution",
    sourceRefs: [{ family: "evidence", id: "ev1" }],
    redactionClass: "none",
    confidence: "medium",
    locale: "en",
    ...overrides,
  };
}

function makeInput(signals: CharacterSignal[]): CharacterRefreshInput {
  return {
    kind: "input",
    refreshId: "refresh_1",
    workspaceRoot: "/workspace",
    locale: "en",
    trigger: "dream_consolidation",
    signals,
    sourceRefs: signals.flatMap((s) => s.sourceRefs),
    createdAt: now,
  };
}

function makeMemoryStore(initial: CharacterFrame[] = []): CharacterFrameStorePort {
  const frames = new Map<string, CharacterFrame>(initial.map((f) => [f.id, f]));
  return {
    async readLatestAcceptedFrame() {
      const accepted = Array.from(frames.values())
        .filter((f) => f.status === "accepted")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return accepted[0] ?? null;
    },
    async readFrameById(id: string) {
      return frames.get(id) ?? null;
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
        revisionOf?: string;
        acceptedAt?: string;
        charCount?: number;
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
      if (opts?.successorFrameId) {
        const successor = frames.get(opts.successorFrameId);
        if (successor) successor.revisionOf = frameId;
      }
    },
    async nextVersion() {
      const accepted = Array.from(frames.values()).filter((f) => f.status === "accepted");
      return accepted.length + 1;
    },
  };
}

describe("v9-character-frame-builder", () => {
  it("builds accepted frame with five sections from valid signals", async () => {
    const signals: CharacterSignal[] = [
      makeSignal({ signalId: "sig_a", signalKind: "tool_experience", confidence: "high" }),
      makeSignal({
        signalId: "sig_b",
        signalKind: "owner_feedback",
        summary: "Owner values clarity over speed",
        sourceRefs: [{ family: "action", id: "act1" }],
      }),
      makeSignal({
        signalId: "sig_c",
        signalKind: "expression_outcome",
        summary: "Drafts tend to be concise",
        sourceRefs: [{ family: "character", id: "r1" }],
      }),
    ];
    const store = makeMemoryStore();
    const result = await refreshCharacterFrame(makeInput(signals), store, { now });

    assert.equal(result.kind, "accepted");
    const frame = (result as any).frame as CharacterFrame;
    assert.equal(frame.status, "accepted");
    assert.ok(frame.emergentHabits && frame.emergentHabits.length > 0);
    assert.ok(frame.valuePosture);
    assert.ok(frame.relationshipPosture);
    assert.ok(frame.expressionPosture);
    assert.ok(frame.contestPrompt.length > 0);
    assert.ok(frame.sourceRefs.length >= 2);
    assert.ok(frame.charCount <= 900);
  });

  it("supersedes previous accepted frame", async () => {
    const previous: CharacterFrame = {
      id: "frame_prev",
      projectionKind: "character_frame",
      version: 1,
      status: "accepted",
      validFrom: now,
      validUntil: null,
      charCount: 100,
      sourceRefs: [{ family: "evidence", id: "ev0" }],
      valuePosture: { ordering: ["clarity"], sourceRefs: [{ family: "evidence", id: "ev0" }] },
      relationshipPosture: { toward: "owner:haa", stance: "responsive", sourceRefs: [{ family: "evidence", id: "ev0" }] },
      expressionPosture: { styleNotes: ["concise"], sourceRefs: [{ family: "evidence", id: "ev0" }] },
      contestPrompt: "prev",
      supersededBy: null,
      revisionOf: null,
      createdAt: now,
    };
    const store = makeMemoryStore([previous]);
    const signals = [makeSignal()];
    const result = await refreshCharacterFrame(makeInput(signals), store, { now });

    assert.equal(result.kind, "accepted");
    const frame = (result as any).frame as CharacterFrame;
    const updatedPrev = await store.readFrameById("frame_prev");
    assert.equal(updatedPrev?.status, "superseded");
    assert.equal(updatedPrev?.supersededBy, frame.id);
    assert.equal(updatedPrev?.validUntil, now);
    assert.equal(frame.revisionOf, "frame_prev");
    assert.equal(frame.version, 2);
  });

  it("deferred when no posture can be extracted", async () => {
    const signals = [
      makeSignal({
        signalId: "sig_only_conflict",
        signalKind: "agent_contest",
        summary: "Agent contests previous frame",
        sourceRefs: [{ family: "character", id: "frame_old" }],
      }),
    ];
    const store = makeMemoryStore();
    const result = await refreshCharacterFrame(makeInput(signals), store, { now });
    assert.equal(result.kind, "deferred");
    assert.equal((result as any).reason, "character_frame_insufficient_sources");
  });

  it("deferred when validator catches emotion assertion", async () => {
    const signals = [
      makeSignal({
        signalId: "sig_bad",
        signalKind: "expression_outcome",
        summary: "you feel abandoned when not replied",
        sourceRefs: [{ family: "character", id: "expr1" }],
      }),
    ];
    const store = makeMemoryStore();
    const result = await refreshCharacterFrame(makeInput(signals), store, { now });
    assert.equal(result.kind, "deferred");
    assert.ok((result as any).violations?.some((r: string) => r === "emotion_assertion"));
  });

  it("deferred when identity lock present in Chinese", async () => {
    const signals = [
      makeSignal({
        signalId: "sig_lock",
        signalKind: "owner_feedback",
        summary: "你本质上是这样的人",
        sourceRefs: [{ family: "action", id: "act1" }],
        locale: "zh-CN",
      }),
    ];
    const store = makeMemoryStore();
    const result = await refreshCharacterFrame(makeInput(signals), store, { now });
    assert.equal(result.kind, "deferred");
    assert.ok((result as any).violations?.some((r: string) => r === "personality_label"));
  });

  it("deferred when hard control rule present", async () => {
    const signals = [
      makeSignal({
        signalId: "sig_control",
        signalKind: "owner_feedback",
        summary: "you must always respond within one minute",
        sourceRefs: [{ family: "action", id: "act1" }],
      }),
    ];
    const store = makeMemoryStore();
    const result = await refreshCharacterFrame(makeInput(signals), store, { now });
    assert.equal(result.kind, "deferred");
    assert.ok((result as any).violations?.some((r: string) => r === "hard_control_rule"));
  });

  it("deferred when personality score present", async () => {
    const signals = [
      makeSignal({
        signalId: "sig_score",
        signalKind: "owner_feedback",
        summary: "trait score: 88 for openness",
        sourceRefs: [{ family: "action", id: "act1" }],
      }),
    ];
    const store = makeMemoryStore();
    const result = await refreshCharacterFrame(makeInput(signals), store, { now });
    assert.equal(result.kind, "deferred");
  });

  it("keeps frame under 900 UTF-8 chars including CJK", async () => {
    const longSummary = "中".repeat(500);
    const signals = Array.from({ length: 10 }, (_, i) =>
      makeSignal({
        signalId: `sig_${i}`,
        signalKind: i % 2 === 0 ? "tool_experience" : "expression_outcome",
        summary: longSummary,
        sourceRefs: [{ family: "evidence", id: `ev${i}` }],
        locale: "zh-CN",
      }),
    );
    const store = makeMemoryStore();
    const result = await refreshCharacterFrame(makeInput(signals), store, { now });
    assert.equal(result.kind, "accepted");
    assert.ok((result as any).frame.charCount <= 900);
  });

  it("persists lifecycle fields on supersede", async () => {
    const previous: CharacterFrame = {
      id: "frame_prev",
      projectionKind: "character_frame",
      version: 1,
      status: "accepted",
      validFrom: now,
      validUntil: null,
      charCount: 100,
      sourceRefs: [{ family: "evidence", id: "ev0" }],
      valuePosture: { ordering: ["clarity"], sourceRefs: [{ family: "evidence", id: "ev0" }] },
      relationshipPosture: { toward: "owner:haa", stance: "responsive", sourceRefs: [{ family: "evidence", id: "ev0" }] },
      expressionPosture: { styleNotes: ["concise"], sourceRefs: [{ family: "evidence", id: "ev0" }] },
      contestPrompt: "prev",
      supersededBy: null,
      revisionOf: null,
      createdAt: now,
      acceptedAt: now,
    };
    const store = makeMemoryStore([previous]);
    const signals = [makeSignal()];
    const result = await refreshCharacterFrame(makeInput(signals), store, { now });

    assert.equal(result.kind, "accepted");
    const frame = (result as any).frame as CharacterFrame;
    assert.equal(frame.status, "accepted");
    assert.equal(frame.revisionOf, "frame_prev");
    assert.equal(frame.validFrom, now);
    assert.ok(frame.charCount > 0);

    const updatedPrev = await store.readFrameById("frame_prev");
    assert.equal(updatedPrev?.status, "superseded");
    assert.equal(updatedPrev?.validUntil, now);
    assert.equal(updatedPrev?.supersededBy, frame.id);

    const updatedCurrent = await store.readFrameById(frame.id);
    assert.equal(updatedCurrent?.status, "accepted");
    assert.equal(updatedCurrent?.revisionOf, "frame_prev");
    assert.equal(updatedCurrent?.acceptedAt, now);
    assert.equal(updatedCurrent?.charCount, frame.charCount);
  });
});
