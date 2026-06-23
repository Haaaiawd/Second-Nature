/**
 * v9 AttentionAssembler unit tests.
 *
 * Covers: identity resolution → scoring → validation → signal, including
 * new/duplicate/changed/unstable repetition, missing source refs, relevance,
 * risk, and ActivityThread suggestions.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createEvidenceIdentityPort } from "../../../src/storage/v9-evidence-identity-port.js";
import { normalizeConnectorEvidence } from "../../../src/connectors/evidence-normalizer.js";
import {
  assembleAttention,
  type AttentionAssemblerInput,
  type RichEvidenceItem,
  type AttentionContext,
} from "../../../src/core/second-nature/perception/attention-assembler.js";
import {
  scoreNovelty,
  scoreRelevance,
  scoreRisk,
  suggestActions,
  suggestActivityThread,
  type AttentionContextGoal,
} from "../../../src/core/second-nature/perception/attention-scorer.js";
import { validateAttentionSignal } from "../../../src/core/second-nature/perception/attention-signal-validator.js";
import type { SourceRef, ActivityThread } from "../../../src/shared/types/v9-contracts.js";

const NOW = "2026-06-20T10:00:00Z";

function makeEvidence(overrides?: Partial<RichEvidenceItem>): RichEvidenceItem {
  return {
    id: "ev-moltbook-post-1",
    platformId: "moltbook",
    capabilityId: "feed.read",
    externalId: "post-1",
    contentHash: "hash-a",
    observedAt: NOW,
    content: "TypeScript best practices for large codebases.",
    summary: "TypeScript best practices for large codebases.",
    sensitivityHint: "public_technical",
    sourceRefs: [{ family: "evidence", id: "ev-moltbook-post-1" }],
    ...overrides,
  };
}

function makeContext(overrides?: Partial<AttentionContext>): AttentionContext {
  return {
    acceptedGoals: [],
    activeProjections: [],
    bodyIntuition: { recentPlatforms: [] },
    routineRegistry: [],
    activeActivityThreads: [],
    cycleSequence: 1,
    ...overrides,
  };
}

describe("v9 AttentionAssembler", () => {
  describe("identity-driven signal assembly", () => {
    it("returns attentive signal with new repetition for first-seen evidence", async () => {
      const db = createStateDatabase(":memory:");
      try {
        // Seed evidence via v8 normalizer so identity columns are populated.
        await normalizeConnectorEvidence(db, {
          status: "success",
          platformId: "moltbook",
          capabilityId: "feed.read",
          data: { posts: [{ id: "post-1", title: "A", content: "content A" }] },
          observedAt: NOW,
        });

        const identityPort = createEvidenceIdentityPort(db);
        const evidence = makeEvidence({ id: "ev_moltbook_feed.read_post-1" });
        const input: AttentionAssemblerInput = { evidence, context: makeContext() };
        const { signal, blocked } = await assembleAttention(input, {
          identityPort,
          cycleId: "cycle-1",
          cycleSequence: 1,
          db,
          now: NOW,
        });

        assert.equal(blocked, false);
        assert.equal(signal.status, "attentive");
        assert.equal(signal.repetition, "new");
        assert.equal(signal.novelty, 1.0);
        assert.ok(signal.possibleActions.includes("defer"));
      } finally {
        db.close();
      }
    });

    it("returns duplicate signal after repeated normalization", async () => {
      const db = createStateDatabase(":memory:");
      try {
        for (let i = 0; i < 3; i++) {
          await normalizeConnectorEvidence(db, {
            status: "success",
            platformId: "moltbook",
            capabilityId: "feed.read",
            data: { posts: [{ id: "post-1", title: "A", content: "content A" }] },
            observedAt: `2026-06-20T10:0${i}:00Z`,
          });
        }

        const identityPort = createEvidenceIdentityPort(db);
        const evidence = makeEvidence({ id: "ev_moltbook_feed.read_post-1", contentHash: undefined });
        const input: AttentionAssemblerInput = { evidence, context: makeContext() };
        const { signal } = await assembleAttention(input, {
          identityPort,
          cycleId: "cycle-1",
          cycleSequence: 1,
          db,
          now: NOW,
        });

        assert.equal(signal.repetition, "duplicate");
        assert.equal(signal.novelty, 0);
      } finally {
        db.close();
      }
    });

    it("blocks signal when source refs are missing", async () => {
      const db = createStateDatabase(":memory:");
      try {
        const identityPort = createEvidenceIdentityPort(db);
        const evidence = makeEvidence({ sourceRefs: [] });
        const input: AttentionAssemblerInput = { evidence, context: makeContext() };
        const { signal, blocked } = await assembleAttention(input, {
          identityPort,
          cycleId: "cycle-1",
          cycleSequence: 1,
          db,
          now: NOW,
        });

        assert.equal(blocked, true);
        assert.equal(signal.status, "attention_blocked_missing_sources");
        assert.equal(signal.reason, "missing_source_refs");
        assert.deepStrictEqual(signal.possibleActions, ["defer"]);
      } finally {
        db.close();
      }
    });

    it("degrades signal when identity is unstable", async () => {
      const db = createStateDatabase(":memory:");
      try {
        const identityPort = createEvidenceIdentityPort(db);
        const evidence = makeEvidence({ externalId: undefined, contentHash: undefined });
        const input: AttentionAssemblerInput = { evidence, context: makeContext() };
        const { signal } = await assembleAttention(input, {
          identityPort,
          cycleId: "cycle-1",
          cycleSequence: 1,
          db,
          now: NOW,
        });

        assert.equal(signal.status, "degraded");
        assert.equal(signal.repetition, "identity_unstable");
        assert.equal(signal.novelty, 0);
      } finally {
        db.close();
      }
    });
  });

  describe("scoring", () => {
    it("scoreNovelty maps repetition kinds to canonical values", () => {
      assert.equal(scoreNovelty("new"), 1.0);
      assert.equal(scoreNovelty("changed"), 0.5);
      assert.equal(scoreNovelty("duplicate"), 0.0);
      assert.equal(scoreNovelty("identity_unstable"), 0.0);
    });

    it("scoreRelevance returns high when goal text overlaps", () => {
      const goal: AttentionContextGoal = { text: "TypeScript best practices" };
      const ctx = makeContext({ acceptedGoals: [goal] });
      const evidence = makeEvidence();
      assert.equal(scoreRelevance(evidence, ctx), 0.8);
    });

    it("scoreRelevance returns medium when projection topic overlaps", () => {
      const ctx = makeContext({ activeProjections: [{ topic: "TypeScript" }] });
      const evidence = makeEvidence();
      assert.equal(scoreRelevance(evidence, ctx), 0.5);
    });

    it("scoreRelevance returns low for recent platform", () => {
      const ctx = makeContext({ bodyIntuition: { recentPlatforms: ["moltbook"] } });
      const evidence = makeEvidence();
      assert.equal(scoreRelevance(evidence, ctx), 0.2);
    });

    it("scoreRisk maps sensitivity hints", () => {
      assert.equal(scoreRisk(makeEvidence({ sensitivityHint: "sensitive" })), "high");
      assert.equal(scoreRisk(makeEvidence({ sensitivityHint: "private_context" })), "medium");
      assert.equal(scoreRisk(makeEvidence({ sensitivityHint: "public_technical" })), "low");
      assert.equal(scoreRisk(makeEvidence({ sensitivityHint: "public_general" })), "low");
    });

    it("suggestActions returns remember for new relevant evidence", () => {
      const goal: AttentionContextGoal = { text: "TypeScript best practices" };
      const ctx = makeContext({ acceptedGoals: [goal] });
      const evidence = makeEvidence();
      const identity = {
        logicalId: "ev-1",
        platformId: "moltbook",
        externalId: "post-1",
        contentHash: "hash-a",
        seenCount: 1,
        firstObservedAt: NOW,
        lastObservedAt: NOW,
        repetitionStatus: "new" as const,
      };
      const actions = suggestActions(evidence, identity, ctx);
      assert.ok(actions.includes("remember"));
    });

    it("suggestActions returns notify_owner/watch for sensitive evidence", () => {
      const ctx = makeContext();
      const evidence = makeEvidence({ sensitivityHint: "sensitive" });
      const identity = {
        logicalId: "ev-1",
        platformId: "moltbook",
        externalId: "post-1",
        contentHash: "hash-a",
        seenCount: 1,
        firstObservedAt: NOW,
        lastObservedAt: NOW,
        repetitionStatus: "new" as const,
      };
      const actions = suggestActions(evidence, identity, ctx);
      assert.ok(actions.includes("notify_owner"));
      assert.ok(actions.includes("watch"));
      assert.ok(!actions.includes("remember"));
    });

    it("suggestActions does not suggest remember for high-risk evidence even when relevant", () => {
      const goal: AttentionContextGoal = { text: "TypeScript best practices" };
      const ctx = makeContext({ acceptedGoals: [goal] });
      const evidence = makeEvidence({ sensitivityHint: "sensitive" });
      const identity = {
        logicalId: "ev-1",
        platformId: "moltbook",
        externalId: "post-1",
        contentHash: "hash-a",
        seenCount: 1,
        firstObservedAt: NOW,
        lastObservedAt: NOW,
        repetitionStatus: "new" as const,
      };
      const actions = suggestActions(evidence, identity, ctx);
      assert.ok(actions.includes("notify_owner"));
      assert.ok(actions.includes("watch"));
      assert.ok(!actions.includes("remember"));
    });
  });

  describe("ActivityThread suggestions", () => {
    it("suggests create for new relevant evidence", () => {
      const goal: AttentionContextGoal = { text: "TypeScript best practices" };
      const ctx = makeContext({ acceptedGoals: [goal] });
      const evidence = makeEvidence();
      const identity = {
        logicalId: "ev-1",
        platformId: "moltbook",
        externalId: "post-1",
        contentHash: "hash-a",
        seenCount: 1,
        firstObservedAt: NOW,
        lastObservedAt: NOW,
        repetitionStatus: "new" as const,
      };
      const result = suggestActivityThread(evidence, identity, ctx);
      assert.equal(result.threadSuggestion, "create");
    });

    it("suggests continue for active matching thread", () => {
      const thread: ActivityThread = {
        threadId: "th-1",
        originAttentionSignalId: "sig-1",
        status: "active",
        currentFocus: "TypeScript best practices",
        associations: [],
        nextPossibleMoves: ["observe"],
        completedStepCount: 1,
        stopCondition: "single_step_done",
        lastHeartbeatSequence: 1,
        sourceRefs: [{ family: "attention", id: "sig-1" }],
        createdAt: NOW,
        updatedAt: NOW,
      };
      const ctx = makeContext({ activeActivityThreads: [thread], cycleSequence: 2 });
      const evidence = makeEvidence();
      const identity = {
        logicalId: "ev-1",
        platformId: "moltbook",
        externalId: "post-1",
        contentHash: "hash-a",
        seenCount: 2,
        firstObservedAt: NOW,
        lastObservedAt: NOW,
        repetitionStatus: "duplicate" as const,
      };
      const result = suggestActivityThread(evidence, identity, ctx);
      assert.equal(result.threadSuggestion, "continue");
      assert.equal(result.activityThreadId, "th-1");
    });

    it("suggests pause for overlong thread", () => {
      const thread: ActivityThread = {
        threadId: "th-1",
        originAttentionSignalId: "sig-1",
        status: "active",
        currentFocus: "TypeScript best practices",
        associations: [],
        nextPossibleMoves: ["observe"],
        completedStepCount: 8,
        stopCondition: "max_steps",
        lastHeartbeatSequence: 1,
        sourceRefs: [{ family: "attention", id: "sig-1" }],
        createdAt: NOW,
        updatedAt: NOW,
      };
      const ctx = makeContext({ activeActivityThreads: [thread], cycleSequence: 2 });
      const evidence = makeEvidence();
      const identity = {
        logicalId: "ev-1",
        platformId: "moltbook",
        externalId: "post-1",
        contentHash: "hash-a",
        seenCount: 2,
        firstObservedAt: NOW,
        lastObservedAt: NOW,
        repetitionStatus: "duplicate" as const,
      };
      const result = suggestActivityThread(evidence, identity, ctx);
      assert.equal(result.threadSuggestion, "pause");
      assert.equal(result.reason, "activity_thread_overlong");
    });
  });

  describe("validation", () => {
    it("downgrades continue/pause/complete to none when activityThreadId is missing", () => {
      const draft: import("../../../src/shared/types/v9-contracts.js").AttentionSignal = {
        signalId: "sig-1",
        sourceRefs: [{ family: "evidence", id: "ev-1" }],
        summary: "summary",
        novelty: 0.5,
        repetition: "changed",
        risk: "low",
        relevance: 0.5,
        status: "attentive",
        possibleActions: ["watch"],
        threadSuggestion: "continue",
      };
      const { signal } = validateAttentionSignal(draft);
      assert.equal(signal.threadSuggestion, "none");
      assert.equal(signal.activityThreadId, undefined);
    });
  });
});
