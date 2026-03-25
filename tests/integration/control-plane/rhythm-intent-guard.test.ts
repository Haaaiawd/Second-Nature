import test from "node:test";
import assert from "node:assert/strict";

import {
  decideDecisionBasis,
  evaluateGuards,
  planIntent,
  selectRhythmWindow,
  validateRhythmPolicy,
  type ContinuitySnapshot,
  type RhythmPolicy,
} from "../../../src/core/second-nature/index.js";

const baseSnapshot: ContinuitySnapshot = {
  mode: "active",
  currentWindowId: "w-active",
  pendingObligations: [],
  recentOutreachHashes: [],
  deniedIntents: [],
  budgets: { socialUsed: 0, socialLimit: 10 },
};

const rhythmPolicy: RhythmPolicy = {
  timezone: "UTC",
  quietSuppressionEnabled: true,
  windows: [
    { id: "w-active", startMinute: 0, endMinute: 1320, mode: "active" },
    { id: "w-quiet", startMinute: 1320, endMinute: 1440, mode: "quiet" },
  ],
};

test("rhythm policy model validates and window selection returns stable top-level mode", () => {
  validateRhythmPolicy(rhythmPolicy);

  const activeDecision = selectRhythmWindow("2026-03-25T10:00:00.000Z", baseSnapshot, rhythmPolicy);
  assert.equal(activeDecision.windowId, "w-active");
  assert.equal(activeDecision.topLevelMode, "active");

  const quietDecision = selectRhythmWindow("2026-03-25T22:30:00.000Z", baseSnapshot, rhythmPolicy);
  assert.equal(quietDecision.windowId, "w-quiet");
  assert.equal(quietDecision.topLevelMode, "quiet");

  const pausedDecision = selectRhythmWindow(
    "2026-03-25T22:30:00.000Z",
    { ...baseSnapshot, mode: "paused_for_interrupt" },
    rhythmPolicy
  );
  assert.equal(pausedDecision.topLevelMode, "paused_for_interrupt");

  const suppressedDecision = selectRhythmWindow(
    "2026-03-25T10:00:00.000Z",
    { ...baseSnapshot, riskSuppressed: true },
    rhythmPolicy
  );
  assert.equal(suppressedDecision.topLevelMode, "maintenance_only");

  const tokyoPolicy: RhythmPolicy = {
    ...rhythmPolicy,
    timezone: "Asia/Tokyo",
    windows: [
      { id: "tokyo-active", startMinute: 0, endMinute: 480, mode: "active" },
      { id: "tokyo-quiet", startMinute: 480, endMinute: 1440, mode: "quiet" },
    ],
  };

  const tokyoDecision = selectRhythmWindow("2026-03-25T00:30:00.000Z", baseSnapshot, tokyoPolicy);
  assert.equal(tokyoDecision.windowId, "tokyo-quiet");
});

test("intent planner produces layered candidates and stable ordering", () => {
  const snapshot: ContinuitySnapshot = {
    ...baseSnapshot,
    mode: "quiet",
    pendingObligations: ["heartbeat"],
  };
  const intents = planIntent(snapshot);

  assert.ok(intents.length > 0);
  assert.equal(intents[0]?.kind, "work");
  assert.ok(intents.some((intent) => intent.kind === "reflection"));
  assert.ok(intents.some((intent) => intent.kind === "maintenance"));
});

test("guard layer applies duplicate budget quiet awaiting_user guards", () => {
  const intents = planIntent({
    ...baseSnapshot,
    mode: "quiet",
    budgets: { socialUsed: 10, socialLimit: 10 },
  });

  const social = intents.find((intent) => intent.kind === "social");
  assert.ok(social);

  const denied = evaluateGuards(social!, {
    ...baseSnapshot,
    mode: "quiet",
    budgets: { socialUsed: 10, socialLimit: 10 },
    deniedIntents: [{ intentHash: `${social!.kind}:${social!.summary}`, reason: "duplicate_intent", at: "now" }],
    awaitingUserInput: true,
  });

  assert.equal(denied.verdict, "deny");
  assert.ok(denied.reasons.includes("duplicate_intent"));
  assert.ok(denied.reasons.includes("budget_exceeded"));
  assert.ok(denied.reasons.includes("quiet_window"));
  assert.ok(denied.reasons.includes("awaiting_user"));
});

test("decision basis stratification keeps rule_only/score_based/model_assisted paths", () => {
  const intents = planIntent({ ...baseSnapshot, mode: "quiet", pendingObligations: ["duty"] });
  const maintenance = intents.find((item) => item.kind === "maintenance");
  const exploration = intents.find((item) => item.kind === "exploration");
  const outreach = intents.find((item) => item.kind === "outreach");
  const obligation = intents.find((item) => item.source === "obligation");

  assert.equal(decideDecisionBasis(maintenance!), "rule_only");
  assert.equal(decideDecisionBasis(exploration!), "score_based");
  assert.equal(decideDecisionBasis(outreach!), "model_assisted");
  assert.equal(decideDecisionBasis(obligation!), "rule_only");
});

test("rhythm policy validation rejects overlapping windows", () => {
  assert.throws(
    () =>
      validateRhythmPolicy({
        timezone: "UTC",
        quietSuppressionEnabled: true,
        windows: [
          { id: "a", startMinute: 0, endMinute: 600, mode: "active" },
          { id: "b", startMinute: 500, endMinute: 700, mode: "quiet" },
        ],
      }),
    /overlapping_window_range/
  );
});
