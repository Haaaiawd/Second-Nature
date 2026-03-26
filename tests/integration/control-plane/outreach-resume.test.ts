import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOutreachMessage,
  evaluateOutreach,
  resumeFromCheckpoint,
} from "../../../src/core/second-nature/index.js";

test("outreach evaluation keeps structured contract and gating separate from message style", async () => {
  const gate = await evaluateOutreach(
    {
      async evaluateOutreachCandidate() {
        return {
          valueScore: 0.82,
          novelty: 0.7,
          userRelevance: 0.9,
          actionability: 0.8,
          urgency: 0.4,
          requiredUserHelp: true,
          isRoutineProgress: false,
          minThreshold: 0.65,
          sourceRefs: ["report:2026-03-25"],
          explanation: "high value",
        };
      },
    },
    {
      candidateId: "outreach-1",
      summary: "need confirmation on platform direction",
      sourceRefs: ["report:2026-03-25"],
      recentOutreachHashes: ["old-1"],
      requiredUserHelp: true,
    }
  );

  assert.equal(gate.allowed, true);
  assert.deepEqual(gate.reasonCodes, []);

  const message = buildOutreachMessage({
    summary: "need confirmation on platform direction",
    evaluation: gate.evaluation,
  });

  assert.equal(message.style, "intent_level_guidance");
  assert.equal(message.maxSentences, 3);
  assert.equal(message.intent.coreMeaning, "need confirmation on platform direction");
  assert.ok(message.intent.deliveryBoundary.length > 0);
  assert.ok(message.avoidFormats.includes("ticket"));
});

test("outreach evaluation rejects routine or weak candidates via structured reasons", async () => {
  const gate = await evaluateOutreach(
    {
      async evaluateOutreachCandidate() {
        return {
          valueScore: 0.2,
          novelty: 0.1,
          userRelevance: 0.2,
          actionability: 0.2,
          urgency: 0.1,
          requiredUserHelp: false,
          isRoutineProgress: true,
          minThreshold: 0.65,
          sourceRefs: [],
          explanation: "routine",
        };
      },
    },
    {
      candidateId: "outreach-2",
      summary: "routine status",
      sourceRefs: [],
      recentOutreachHashes: ["outreach-2"],
    }
  );

  assert.equal(gate.allowed, false);
  assert.ok(gate.reasonCodes.includes("missing_sources"));
  assert.ok(gate.reasonCodes.includes("value_below_threshold"));
  assert.ok(gate.reasonCodes.includes("routine_progress_suppressed"));
  assert.ok(gate.reasonCodes.includes("recent_duplicate_outreach"));
});

test("outreach duplicate suppression uses candidate duplicate semantics not list volume", async () => {
  const baseEval = {
    valueScore: 0.9,
    novelty: 0.8,
    userRelevance: 0.9,
    actionability: 0.8,
    urgency: 0.6,
    requiredUserHelp: false,
    isRoutineProgress: false,
    minThreshold: 0.65,
    sourceRefs: ["report:2026-03-25"],
    explanation: "valid",
  };

  const noDuplicate = await evaluateOutreach(
    {
      async evaluateOutreachCandidate() {
        return baseEval;
      },
    },
    {
      candidateId: "outreach-unique",
      summary: "fresh summary",
      sourceRefs: ["report:2026-03-25"],
      recentOutreachHashes: ["h1", "h2", "h3", "h4", "h5", "h6"],
    }
  );
  assert.equal(noDuplicate.allowed, true);
  assert.ok(!noDuplicate.reasonCodes.includes("recent_duplicate_outreach"));

  const fingerprint = "outreach-dup|need confirmation on platform direction";
  const duplicate = await evaluateOutreach(
    {
      async evaluateOutreachCandidate() {
        return baseEval;
      },
    },
    {
      candidateId: "outreach-dup",
      summary: "Need confirmation on platform direction",
      sourceRefs: ["report:2026-03-25"],
      recentOutreachHashes: [fingerprint],
    }
  );
  assert.equal(duplicate.allowed, false);
  assert.ok(duplicate.reasonCodes.includes("recent_duplicate_outreach"));
});

test("resumeFromCheckpoint branches by commit-state only", async () => {
  const missing = await resumeFromCheckpoint(
    {
      async loadCheckpoint() {
        return null;
      },
      async loadIntentCommitRecord() {
        return null;
      },
      async loadSnapshotByRef() {
        return {};
      },
    },
    "checkpoint-missing"
  );
  assert.equal(missing.status, "missing_checkpoint");

  const committed = await resumeFromCheckpoint(
    {
      async loadCheckpoint() {
        return { id: "cp1", intentId: "intent-1", snapshotRef: "snap-1" };
      },
      async loadIntentCommitRecord() {
        return { id: "c1", intentId: "intent-1", state: "committed", outcomeRef: "ok" };
      },
      async loadSnapshotByRef() {
        return { any: true };
      },
    },
    "cp1"
  );
  assert.equal(committed.status, "already_committed");

  const reconcile = await resumeFromCheckpoint(
    {
      async loadCheckpoint() {
        return { id: "cp2", intentId: "intent-2", snapshotRef: "snap-2" };
      },
      async loadIntentCommitRecord() {
        return { id: "c2", intentId: "intent-2", state: "externally_acknowledged", outcomeRef: "ack" };
      },
      async loadSnapshotByRef() {
        return { any: true };
      },
    },
    "cp2"
  );
  assert.equal(reconcile.status, "needs_reconcile");

  const ready = await resumeFromCheckpoint(
    {
      async loadCheckpoint() {
        return { id: "cp3", intentId: "intent-3", snapshotRef: "snap-3" };
      },
      async loadIntentCommitRecord() {
        return { id: "c3", intentId: "intent-3", state: "planned" };
      },
      async loadSnapshotByRef(snapshotRef) {
        return { snapshotRef, mode: "active" };
      },
    },
    "cp3"
  );
  assert.equal(ready.status, "ready_to_resume");
  if (ready.status === "ready_to_resume") {
    assert.equal(ready.snapshot.snapshotRef, "snap-3");
  }
});
