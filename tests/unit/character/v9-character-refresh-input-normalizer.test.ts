/**
 * v9 Character Refresh Input Normalizer — Unit Tests
 *
 * Validates: empty/invalid/redacted signal handling, allowed source families,
 * raw payload shape detection, locale inference.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  normalizeCharacterRefreshInput,
  CHARACTER_SIGNAL_ALLOWED_SOURCE_FAMILIES,
  type CharacterFrameDeferredResult,
} from "../../../src/core/second-nature/character/character-refresh-input-normalizer.js";
import type { CharacterSignal } from "../../../src/shared/types/v9-contracts.js";

const baseContext = {
  refreshId: "refresh_1",
  workspaceRoot: "/workspace",
  trigger: "dream_consolidation" as const,
  now: "2026-06-26T00:00:00Z",
};

function makeSignal(
  overrides: Partial<CharacterSignal> = {},
): CharacterSignal {
  return {
    signalId: "sig_1",
    signalKind: "tool_experience",
    originSystem: "memory-continuity-system",
    summary: "Repeated successful feed.read execution",
    sourceRefs: [{ family: "evidence", id: "ev1" }],
    redactionClass: "none",
    confidence: "medium",
    locale: "en",
    ...overrides,
  };
}

describe("v9-character-refresh-input-normalizer", () => {
  it("deferred when signals empty", () => {
    const result = normalizeCharacterRefreshInput([], baseContext);
    assert.equal(result.kind, "deferred");
    assert.equal((result as CharacterFrameDeferredResult).reason, "character_frame_insufficient_sources");
  });

  it("deferred when signal sourceRefs empty", () => {
    const result = normalizeCharacterRefreshInput(
      [makeSignal({ sourceRefs: [] })],
      baseContext,
    );
    assert.equal(result.kind, "deferred");
    assert.equal((result as CharacterFrameDeferredResult).reason, "character_frame_insufficient_sources");
  });

  it("deferred when source family disallowed", () => {
    const result = normalizeCharacterRefreshInput(
      [makeSignal({ sourceRefs: [{ family: "attention", id: "att1" }] })],
      baseContext,
    );
    assert.equal(result.kind, "deferred");
    assert.equal((result as CharacterFrameDeferredResult).reason, "character_refresh_input_invalid");
  });

  it("deferred when redactionClass is credential_blocked", () => {
    const result = normalizeCharacterRefreshInput(
      [makeSignal({ redactionClass: "credential_blocked" })],
      baseContext,
    );
    assert.equal(result.kind, "deferred");
    assert.equal((result as CharacterFrameDeferredResult).reason, "character_refresh_input_redacted");
  });

  it("deferred when summary contains API key shape", () => {
    const result = normalizeCharacterRefreshInput(
      [makeSignal({ summary: "observed apiKey: sk-abc1234567890abcdef" })],
      baseContext,
    );
    assert.equal(result.kind, "deferred");
    assert.equal((result as CharacterFrameDeferredResult).reason, "character_refresh_input_redacted");
  });

  it("returns canonical CharacterRefreshInput for valid signals", () => {
    const signals = [
      makeSignal({ signalId: "sig_a", summary: "Tool success pattern A" }),
      makeSignal({
        signalId: "sig_b",
        signalKind: "owner_feedback",
        summary: "Owner prefers concise replies",
        sourceRefs: [{ family: "action", id: "act1" }],
        locale: "zh-CN",
      }),
    ];
    const result = normalizeCharacterRefreshInput(signals, baseContext);
    assert.equal(result.kind, "input");
    const input = result as Exclude<typeof result, CharacterFrameDeferredResult>;
    assert.equal(input.refreshId, baseContext.refreshId);
    assert.equal(input.signals.length, 2);
    assert.equal(input.locale, "mixed");
    assert.ok(input.sourceRefs.some((ref) => ref.family === "evidence"));
    assert.ok(input.sourceRefs.some((ref) => ref.family === "action"));
  });

  it("deduplicates source refs", () => {
    const sharedRef = { family: "evidence" as const, id: "ev1" };
    const result = normalizeCharacterRefreshInput(
      [
        makeSignal({ signalId: "sig_a", sourceRefs: [sharedRef] }),
        makeSignal({ signalId: "sig_b", sourceRefs: [sharedRef] }),
      ],
      baseContext,
    );
    assert.equal(result.kind, "input");
    assert.equal(result.sourceRefs.length, 1);
  });

  it("deferred when signal source family is only character and not agent_contest", () => {
    const result = normalizeCharacterRefreshInput(
      [makeSignal({ signalKind: "owner_feedback", sourceRefs: [{ family: "character", id: "frame_old" }] })],
      baseContext,
    );
    assert.equal(result.kind, "deferred");
    assert.equal((result as CharacterFrameDeferredResult).reason, "character_refresh_input_redacted");
  });

  it("allows agent_contest signal with only character family source refs", () => {
    const result = normalizeCharacterRefreshInput(
      [
        makeSignal({
          signalId: "sig_contest",
          signalKind: "agent_contest",
          summary: "contest previous frame",
          sourceRefs: [{ family: "character", id: "frame_old" }],
        }),
        makeSignal({ signalId: "sig_tool", signalKind: "tool_experience" }),
      ],
      baseContext,
    );
    assert.equal(result.kind, "input");
  });

  it("allowed source family set includes expected families", () => {
    assert.ok(CHARACTER_SIGNAL_ALLOWED_SOURCE_FAMILIES.has("evidence"));
    assert.ok(CHARACTER_SIGNAL_ALLOWED_SOURCE_FAMILIES.has("character"));
    assert.ok(!CHARACTER_SIGNAL_ALLOWED_SOURCE_FAMILIES.has("attention"));
  });
});
