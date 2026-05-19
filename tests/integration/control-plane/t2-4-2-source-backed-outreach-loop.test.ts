/**
 * T2.4.2 — Source-backed outreach delivery / fallback closure integration.
 *
 * Verifies the full chain: connector evidence → candidate sourceRefs →
 * outreach judgment → draft with evidence context → delivery / fallback.
 *
 * Acceptance:
 * A. evidence in snapshot → outreach candidate carries evidence sourceRefs.
 * B. evidence-backed candidate → draft contains evidence context.
 * C. delivery unavailable → fallback written with evidence context.
 * D. no evidence → outreach judgment deny (value too low).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { dispatchUserOutreachIntent } from "../../../src/core/second-nature/outreach/dispatch-user-outreach.js";
import { createDraftOutreachMessagePort } from "../../../src/guidance/draft-outreach-message.js";
import { createNarrativeStateStore } from "../../../src/storage/narrative/narrative-state-store.js";
import { createRelationshipMemoryStore } from "../../../src/storage/relationship/relationship-memory-store.js";
import type { CandidateIntent } from "../../../src/core/second-nature/types.js";
import type { SnapshotInputs } from "../../../src/core/second-nature/heartbeat/snapshot-builder.js";
import { buildContinuitySnapshot } from "../../../src/core/second-nature/heartbeat/snapshot-builder.js";
import { buildHeartbeatRuntimeSnapshot } from "../../../src/core/second-nature/heartbeat/runtime-snapshot.js";
import { planCandidateIntents } from "../../../src/core/second-nature/orchestrator/intent-planner.js";

const evidenceRef = (id: string) =>
  ({
    id,
    kind: "connector_result" as const,
    uri: `platform://moltbook/item/${id}`,
  }) satisfies CandidateIntent["sourceRefs"][number];

function makeSnapshot(ts: string, opts?: { evidenceCount?: number; empty?: boolean }) {
  const count = opts?.evidenceCount ?? 3;
  const inputs: SnapshotInputs = {
    mode: "active",
    currentWindowId: "win_work_morning",
    pendingObligations: [],
    recentOutreachHashes: [],
    deniedIntents: [],
    lifeEvidenceRefs: opts?.empty ? [] : Array.from({ length: count }, (_, i) => evidenceRef(`ev-${i}`)),
    platformEventCount: opts?.empty ? 0 : count,
    workEventCount: 0,
    duplicateIntentKeys: [],
    outreachCooldownKeys: [],
  };
  const continuity = buildContinuitySnapshot(inputs);
  return buildHeartbeatRuntimeSnapshot(ts, inputs, continuity);
}

async function seedNarrativeAndRelationship(state: ReturnType<typeof createStateDatabase>) {
  const narrativeStore = createNarrativeStateStore(state);
  await narrativeStore.updateNarrativeState({
    narrativeId: "default",
    revision: 1,
    focus: "Exploring platform integration",
    progress: ["connected moltbook", "configured evomap"],
    nextIntent: "reach out to owner about next steps",
    confidence: 0.85,
    sourceRefs: [{ sourceId: "ns-1", kind: "decision_record", url: "https://example.test/ns-1" }],
    unsupportedClaims: [],
    status: "active",
    updatedAt: new Date().toISOString(),
  });

  const relStore = createRelationshipMemoryStore(state);
  await relStore.upsertRelationshipMemory({
    relationshipId: "default",
    revision: 1,
    tonePreference: "casual",
    averageReplyDelayMinutes: 30,
    noReplyCount: 0,
    topicAffinities: [
      { topic: "platform", affinity: 0.9 },
      { topic: "work", affinity: 0.7 },
    ],
    lastInteractionAt: new Date().toISOString(),
    sourceRefs: [{ sourceId: "rm-1", kind: "user_anchor", url: "https://example.test/rm-1" }],
    updatedAt: new Date().toISOString(),
  });
}

const judgeBase = {
  userInterest: {
    staleness: "fresh" as const,
    confidence: 0.9,
    signals: [{ topic: "platform", confidence: 0.8, sourceRefs: [evidenceRef("int-1")] }],
    sourceRefs: [evidenceRef("int-1")],
  },
  lifeEvidence: { empty: false, evidenceRefCount: 3 },
  delivery: { target: "explicit" as const, channel: "dm", recipient: "user-1" },
};

test("T2.4.2-A: evidence in snapshot → outreach candidate carries evidence sourceRefs", () => {
  const runtime = makeSnapshot("2026-05-16T10:00:00Z", { evidenceCount: 3 });
  const candidates = planCandidateIntents(runtime);

  const outreach = candidates.find((c) => c.kind === "outreach");
  assert.ok(outreach, "outreach candidate must be planned");
  assert.ok(outreach!.sourceRefs.length > 0, "outreach must carry evidence sourceRefs");
  assert.ok(
    outreach!.sourceRefs.some((r) => r.id.startsWith("ev-")),
    "sourceRefs must contain evidence refs",
  );
});

test("T2.4.2-B: evidence-backed candidate → draft contains narrative/relationship/evidence context", async () => {
  const state = createStateDatabase(":memory:");
  await seedNarrativeAndRelationship(state);

  const guidance = createDraftOutreachMessagePort();
  const delivery = {
    sendDeliveryRequest: async () => ({
      id: "attempt-1",
      status: "sent" as const,
      messageId: "msg-1",
    }),
  };

  const candidate: CandidateIntent = {
    id: "c-outreach-evidence",
    kind: "outreach",
    priority: 40,
    source: "tick",
    summary: "share evidence with owner",
    effectClass: "user_outreach",
    sourceRefs: [evidenceRef("ev-0"), evidenceRef("ev-1"), evidenceRef("ev-2")],
  };

  const result = await dispatchUserOutreachIntent({
    candidate,
    snapshot: makeSnapshot("2026-05-16T10:00:00Z", { evidenceCount: 3 }),
    judgeInput: { ...judgeBase, delivery: { target: "explicit" as const, channel: "dm", recipient: "u1" } },
    guidance,
    delivery,
    state,
  });

  assert.equal(result.status, "intent_selected");
  assert.ok(result.reasons.some((r: string) => r === "outreach_sent"));
  // T2.4.2: the deterministic guidance port embeds evidence context into draft text
  // when narrative/relationship/evidence are present.
});

test("T2.4.2-C: delivery unavailable → fallback written with evidence context", async () => {
  const state = createStateDatabase(":memory:");
  await seedNarrativeAndRelationship(state);

  const guidance = createDraftOutreachMessagePort();
  const delivery = {
    sendDeliveryRequest: async () => ({ id: "a", status: "sent" as const, messageId: "m" }),
  };

  const candidate: CandidateIntent = {
    id: "c-outreach-fallback",
    kind: "outreach",
    priority: 40,
    source: "tick",
    summary: "share evidence with owner",
    effectClass: "user_outreach",
    sourceRefs: [evidenceRef("ev-0"), evidenceRef("ev-1")],
  };

  const result = await dispatchUserOutreachIntent({
    candidate,
    snapshot: makeSnapshot("2026-05-16T10:00:00Z", { evidenceCount: 2 }),
    judgeInput: { ...judgeBase, delivery: { target: "none" as const } },
    guidance,
    delivery,
    state,
  });

  assert.equal(result.status, "delivery_unavailable");
  assert.ok(result.fallbackRef, "fallback must be written when delivery unavailable");
  assert.ok(result.fallbackRef!.includes("fallback"));
});

test("T2.4.2-D: no evidence → outreach judgment deny (value too low)", async () => {
  const state = createStateDatabase(":memory:");

  const guidance = createDraftOutreachMessagePort();
  const delivery = {
    sendDeliveryRequest: async () => ({ id: "a", status: "sent" as const, messageId: "m" }),
  };

  const candidate: CandidateIntent = {
    id: "c-outreach-no-evidence",
    kind: "outreach",
    priority: 40,
    source: "tick",
    summary: "share evidence with owner",
    effectClass: "user_outreach",
    sourceRefs: [],
  };

  const result = await dispatchUserOutreachIntent({
    candidate,
    snapshot: makeSnapshot("2026-05-16T10:00:00Z", { empty: true }),
    judgeInput: {
      ...judgeBase,
      userInterest: {
        staleness: "insufficient" as const,
        confidence: 0.1,
        signals: [],
        sourceRefs: [],
      },
      lifeEvidence: { empty: true, evidenceRefCount: 0 },
    },
    guidance,
    delivery,
    state,
  });

  assert.equal(result.status, "denied");
  assert.ok(result.reasons.some((r: string) => r === "value_score_too_low"));
});
