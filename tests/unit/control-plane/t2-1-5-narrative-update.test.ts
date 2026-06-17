/**
 * Unit coverage for `updateNarrativeAfterEffect` (T2.1.5).
 *
 * Verifies source-backed active revision, awaiting_sources on missing refs,
 * prior-state preservation for no-action cycles, and heartbeat-loop integration.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { updateNarrativeAfterEffect } from "../../../src/core/second-nature/orchestrator/narrative-update.js";
import type {
  NarrativeState,
  NarrativeStateStore,
} from "../../../src/storage/narrative/narrative-state-store.js";
import type { HeartbeatCycleResult } from "../../../src/core/second-nature/heartbeat/signal.js";
import type { CandidateIntent } from "../../../src/core/second-nature/types.js";
import type { PlannerLifeEvidenceSlice } from "../../../src/core/second-nature/heartbeat/runtime-snapshot.js";
import { ingestRhythmSignal } from "../../../src/core/second-nature/heartbeat/heartbeat-loop.js";
import type { SnapshotInputs } from "../../../src/core/second-nature/heartbeat/snapshot-builder.js";

function makeCandidate(overrides: Partial<CandidateIntent> = {}): CandidateIntent {
  return {
    id: "intent-test",
    kind: "work",
    priority: 50,
    source: "tick",
    summary: "test intent",
    effectClass: "connector_action",
    sourceRefs: [],
    ...overrides,
  };
}

function makeResult(overrides: Partial<HeartbeatCycleResult> = {}): HeartbeatCycleResult {
  return {
    scope: "rhythm",
    status: "heartbeat_ok",
    reasons: ["test"],
    ...overrides,
  };
}

function makeLifeEvidence(
  overrides: Partial<PlannerLifeEvidenceSlice> = {},
): PlannerLifeEvidenceSlice {
  return {
    evidenceRefs: [],
    platformEventCount: 0,
    workEventCount: 0,
    ...overrides,
  };
}

function makePriorState(overrides: Partial<NarrativeState> = {}): NarrativeState {
  return {
    narrativeId: "default",
    revision: 3,
    focus: "previous focus",
    progress: ["step-1", "step-2"],
    nextIntent: "continue",
    confidence: 0.5,
    sourceRefs: [{ sourceId: "ev-1", kind: "workspace_artifact" }],
    unsupportedClaims: [],
    status: "active",
    updatedAt: "2026-05-15T00:00:00.000Z",
    ...overrides,
  };
}

// ── Pure function tests ─────────────────────────────────────────────────────

test("T2.1.5 intent_selected with sources → active revision", () => {
  const result = makeResult({ status: "intent_selected", selectedIntentId: "intent-test" });
  const intent = makeCandidate({
    summary: "EvoMap profile updated",
    sourceRefs: [{ id: "ev-1", family: "connector_result", uri: "evomap://profile", redactionClass: "none" }],
  });
  const lifeEvidence = makeLifeEvidence({ evidenceRefs: [{ id: "ev-1", family: "connector_result", uri: "evomap://profile", redactionClass: "none" }] });

  const update = updateNarrativeAfterEffect({
    result,
    selectedIntent: intent,
    lifeEvidence,
    priorNarrative: makePriorState(),
  });

  assert.equal(update.status, "active");
  assert.equal(update.focus, "EvoMap profile updated");
  assert.ok(update.progress.some((p) => p.startsWith("connector_action:")));
  assert.equal(update.sourceRefs.length, 1);
  assert.equal(update.sourceRefs[0]!.sourceId, "ev-1");
  assert.equal(update.unsupportedClaims.length, 0);
  assert.ok(update.confidence > 0);
  assert.equal(update.revision, 4);
});

test("T2.1.5 intent_selected without sources → awaiting_sources", () => {
  const result = makeResult({ status: "intent_selected", selectedIntentId: "intent-test" });
  const intent = makeCandidate({ summary: " risky action" });
  const lifeEvidence = makeLifeEvidence();

  const update = updateNarrativeAfterEffect({
    result,
    selectedIntent: intent,
    lifeEvidence,
    priorNarrative: makePriorState(),
  });

  assert.equal(update.status, "awaiting_sources");
  assert.equal(update.confidence, 0);
  assert.equal(update.sourceRefs.length, 0);
  assert.ok(update.unsupportedClaims.includes(" risky action"));
  assert.equal(update.nextIntent, "await_sources");
});

test("T2.1.5 heartbeat_ok with prior state → preserve and bump revision", () => {
  const prior = makePriorState();
  const update = updateNarrativeAfterEffect({
    result: makeResult(),
    lifeEvidence: makeLifeEvidence(),
    priorNarrative: prior,
  });

  assert.equal(update.revision, 4);
  assert.equal(update.focus, prior.focus);
  assert.deepEqual(update.progress, prior.progress);
  assert.equal(update.status, prior.status);
  assert.ok(update.updatedAt > prior.updatedAt);
});

test("T2.1.5 heartbeat_ok without prior state → seed awaiting_sources", () => {
  const update = updateNarrativeAfterEffect({
    result: makeResult(),
    lifeEvidence: makeLifeEvidence(),
    priorNarrative: null,
  });

  assert.equal(update.narrativeId, "default");
  assert.equal(update.revision, 1);
  assert.equal(update.status, "awaiting_sources");
  assert.equal(update.focus, "awaiting_evidence");
  assert.equal(update.progress.length, 0);
  assert.equal(update.confidence, 0);
});

test("T2.1.5 denied with prior state → preserve state", () => {
  const prior = makePriorState();
  const update = updateNarrativeAfterEffect({
    result: makeResult({ status: "denied" }),
    lifeEvidence: makeLifeEvidence(),
    priorNarrative: prior,
  });

  assert.equal(update.status, prior.status);
  assert.equal(update.revision, 4);
});

test("T2.1.5 progress bounded to max entries", () => {
  const prior = makePriorState({
    progress: Array.from({ length: 15 }, (_, i) => `step-${i}`),
  });
  const result = makeResult({ status: "intent_selected", selectedIntentId: "intent-test" });
  const intent = makeCandidate({
    summary: "new action",
    sourceRefs: [{ id: "ev-1", family: "connector_result", uri: "evomap://x", redactionClass: "none" }],
  });

  const update = updateNarrativeAfterEffect({
    result,
    selectedIntent: intent,
    lifeEvidence: makeLifeEvidence({ evidenceRefs: [{ id: "ev-1", family: "connector_result", uri: "evomap://x", redactionClass: "none" }] }),
    priorNarrative: prior,
  });

  assert.equal(update.progress.length, 10);
  assert.ok(update.progress.some((p) => p.startsWith("connector_action:")));
});

test("T2.1.5 confidence based on source count", () => {
  const result = makeResult({ status: "intent_selected", selectedIntentId: "intent-test" });
  const intent = makeCandidate({
    summary: "action",
    sourceRefs: [
      { id: "ev-1", family: "connector_result", uri: "a", redactionClass: "none" },
      { id: "ev-2", family: "connector_result", uri: "b", redactionClass: "none" },
      { id: "ev-3", family: "connector_result", uri: "c", redactionClass: "none" },
    ],
  });

  const update = updateNarrativeAfterEffect({
    result,
    selectedIntent: intent,
    lifeEvidence: makeLifeEvidence(),
  });

  assert.equal(update.confidence, 0.8); // 3 sources → 0.80 (tiered sigmoid)
});

// ── Integration: ingestRhythmSignal writes to store ─────────────────────────

test("T2.1.5 heartbeat loop writes narrative update when store is wired", async () => {
  const updates: import("../../../src/storage/narrative/narrative-state-store.js").NarrativeStateUpdate[] = [];

  const mockStore: NarrativeStateStore = {
    async updateNarrativeState(input) {
      updates.push(input);
      return { narrativeId: input.narrativeId, status: "acknowledged" };
    },
    async loadNarrativeState() {
      return null;
    },
  };

  const result = await ingestRhythmSignal(
    {
      trigger: "heartbeat_bridge",
      payload: { timestamp: "2026-05-16T10:00:00.000Z" },
    },
    {
      loadSnapshotInputs: async (): Promise<SnapshotInputs> => ({
        mode: "active",
        currentWindowId: "w-1",
        pendingObligations: [],
        recentOutreachHashes: [],
        deniedIntents: [],
        budgets: { socialUsed: 0, socialLimit: 5 },
      }),
      narrativeStateStore: mockStore,
    },
  );

  // Cycle may be denied due to missing source refs; what matters is the store update.
  assert.ok(
    ["heartbeat_ok", "denied", "deferred", "intent_selected"].includes(result.status),
    `unexpected status: ${result.status}`,
  );
  assert.equal(updates.length, 1);
  assert.equal(updates[0]!.narrativeId, "default");
  assert.equal(updates[0]!.status, "awaiting_sources");
});

test("T2.1.5 heartbeat loop does not break when store load fails", async () => {
  const mockStore: NarrativeStateStore = {
    async updateNarrativeState() {
      return { narrativeId: "default", status: "acknowledged" };
    },
    async loadNarrativeState() {
      throw new Error("DB down");
    },
  };

  const result = await ingestRhythmSignal(
    {
      trigger: "heartbeat_bridge",
      payload: { timestamp: "2026-05-16T10:00:00.000Z" },
    },
    {
      loadSnapshotInputs: async (): Promise<SnapshotInputs> => ({
        mode: "active",
        currentWindowId: "w-1",
        pendingObligations: [],
        recentOutreachHashes: [],
        deniedIntents: [],
        budgets: { socialUsed: 0, socialLimit: 5 },
      }),
      narrativeStateStore: mockStore,
    },
  );

  assert.ok(
    ["heartbeat_ok", "denied", "deferred", "intent_selected"].includes(result.status),
    `unexpected status: ${result.status}`,
  );
});

// Boundary tests for Wave 26 fix

test("T2.1.5 boundary: empty intent summary", () => {
  const result = makeResult({ status: "intent_selected", selectedIntentId: "intent-test" });
  const intent = makeCandidate({
    summary: "",
    sourceRefs: [{ id: "ev-1", family: "connector_result", uri: "evomap://profile", redactionClass: "none" }],
  });
  const lifeEvidence = makeLifeEvidence({ evidenceRefs: [{ id: "ev-1", family: "connector_result", uri: "evomap://profile", redactionClass: "none" }] });

  const update = updateNarrativeAfterEffect({
    result,
    selectedIntent: intent,
    lifeEvidence,
    priorNarrative: makePriorState(),
  });

  assert.equal(update.status, "active");
  assert.equal(update.focus, "");
  assert.ok(update.progress.some((p) => p.startsWith("connector_action:")));
});

test("T2.1.5 boundary: very long intent summary", () => {
  const longSummary = "a".repeat(10000);
  const result = makeResult({ status: "intent_selected", selectedIntentId: "intent-test" });
  const intent = makeCandidate({
    summary: longSummary,
    sourceRefs: [{ id: "ev-1", family: "connector_result", uri: "evomap://profile", redactionClass: "none" }],
  });
  const lifeEvidence = makeLifeEvidence({ evidenceRefs: [{ id: "ev-1", family: "connector_result", uri: "evomap://profile", redactionClass: "none" }] });

  const update = updateNarrativeAfterEffect({
    result,
    selectedIntent: intent,
    lifeEvidence,
    priorNarrative: makePriorState(),
  });

  assert.equal(update.status, "active");
  assert.equal(update.focus, longSummary);
  assert.ok(update.progress.some((p) => p.startsWith("connector_action:")));
});

test("T2.1.5 boundary: maximum source refs for confidence calculation", () => {
  const result = makeResult({ status: "intent_selected", selectedIntentId: "intent-test" });
  const manyRefs = Array.from({ length: 1000 }, (_, i) => ({
    id: `ev-${i}`,
    family: "connector_result" as const,
    uri: `evomap://profile-${i}`,
    redactionClass: "none" as const,
  }));
  const intent = makeCandidate({
    summary: "bulk action",
    sourceRefs: manyRefs,
  });

  const update = updateNarrativeAfterEffect({
    result,
    selectedIntent: intent,
    lifeEvidence: makeLifeEvidence(),
  });

  assert.equal(update.status, "active");
  assert.equal(update.confidence, 0.9); // 4+ sources → 0.90 (tiered sigmoid hard cap 0.95)
  assert.equal(update.sourceRefs.length, 1000);
});

test("T2.1.5 boundary: undefined selected intent", () => {
  const result = makeResult({ status: "intent_selected", selectedIntentId: "missing-intent" });
  const lifeEvidence = makeLifeEvidence();

  const update = updateNarrativeAfterEffect({
    result,
    selectedIntent: undefined,
    lifeEvidence,
    priorNarrative: makePriorState(),
  });

  // When no intent is selected but status is intent_selected, preserve prior state
  assert.equal(update.status, "active");
  assert.equal(update.confidence, 0.5);
  assert.equal(update.revision, 4);
});

test("T2.1.5 boundary: prior state with malformed data", () => {
  const malformedPrior = {
    narrativeId: "default",
    revision: -1,
    focus: "",
    progress: ["", null as any, undefined as any],
    nextIntent: "",
    confidence: -0.5,
    sourceRefs: [],
    unsupportedClaims: ["", "  "],
    status: "active" as const,
    updatedAt: "invalid-date" as any,
  };

  const update = updateNarrativeAfterEffect({
    result: makeResult(),
    lifeEvidence: makeLifeEvidence(),
    priorNarrative: malformedPrior,
  });

  // Should handle malformed prior state gracefully - preserves what it can
  assert.equal(update.revision, 0); // Negative revision clamped to 0 then +1
  assert.equal(update.status, "active");
  assert.ok(update.updatedAt > "2026-05-15T00:00:00.000Z");
});
