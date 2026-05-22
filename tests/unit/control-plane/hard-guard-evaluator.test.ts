import { describe, it } from "node:test";
import assert from "node:assert";
import { evaluateHardGuards } from "../../../src/core/second-nature/orchestrator/hard-guard-evaluator.js";
import type { CandidateIntent } from "../../../src/core/second-nature/types.js";

function makeIntent(overrides: Partial<CandidateIntent> = {}): CandidateIntent {
  return {
    id: "intent-test",
    kind: "work",
    priority: 100,
    source: "tick",
    platformId: "moltbook",
    summary: "test intent",
    effectClass: "connector_action",
    sourceRefs: [{ id: "ref-1", kind: "platform_item", uri: "uri://1" }],
    idempotencyKey: "test-key",
    capabilityIntent: "feed.read",
    ...overrides,
  } as CandidateIntent;
}

describe("evaluateHardGuards", () => {
  const baseDeps = {
    hasDuplicateIntent: () => false,
    isOutreachCooldownClear: () => true,
    affordanceMap: {
      moltbook: [
        { platformId: "moltbook", capabilityId: "feed.read", intent: "feed.read", status: "safe" as const },
      ],
    },
  };

  it("allows healthy connector_action with source refs and healthy affordance", () => {
    const result = evaluateHardGuards(makeIntent(), baseDeps);
    assert.strictEqual(result.verdict, "allow");
    assert.deepStrictEqual(result.reasons, []);
  });

  it("defers connector_action when affordance status is painful (circuit open)", () => {
    const intent = makeIntent();
    const deps = {
      ...baseDeps,
      affordanceMap: {
        moltbook: [
          { platformId: "moltbook", capabilityId: "feed.read", intent: "feed.read", status: "painful" as const },
        ],
      },
    };
    const result = evaluateHardGuards(intent, deps);
    assert.strictEqual(result.verdict, "defer");
    assert(result.reasons.includes("connector_circuit_open"));
  });

  it("defers connector_action when affordance status is unavailable", () => {
    const intent = makeIntent();
    const deps = {
      ...baseDeps,
      affordanceMap: {
        moltbook: [
          { platformId: "moltbook", capabilityId: "feed.read", intent: "feed.read", status: "unavailable" as const },
        ],
      },
    };
    const result = evaluateHardGuards(intent, deps);
    assert.strictEqual(result.verdict, "defer");
    assert(result.reasons.includes("affordance_unavailable"));
  });

  it("denies when sourceRefs are missing for connector_action", () => {
    const intent = makeIntent({ sourceRefs: [] });
    const result = evaluateHardGuards(intent, baseDeps);
    assert.strictEqual(result.verdict, "deny");
    assert(result.reasons.includes("missing_source_refs"));
  });

  it("allows maintenance intent even without source refs", () => {
    const intent = makeIntent({ effectClass: "maintenance", sourceRefs: [] });
    const result = evaluateHardGuards(intent, baseDeps);
    assert.strictEqual(result.verdict, "allow");
  });

  it("defers on duplicate intent", () => {
    const deps = { ...baseDeps, hasDuplicateIntent: () => true };
    const result = evaluateHardGuards(makeIntent(), deps);
    assert.strictEqual(result.verdict, "defer");
    assert(result.reasons.includes("duplicate_intent"));
  });

  it("defers on outreach cooldown", () => {
    const intent = makeIntent({ effectClass: "user_outreach" });
    const deps = { ...baseDeps, isOutreachCooldownClear: () => false };
    const result = evaluateHardGuards(intent, deps);
    assert.strictEqual(result.verdict, "defer");
    assert(result.reasons.includes("outreach_cooldown"));
  });

  it("denies on budget exceeded", () => {
    const intent = makeIntent({ kind: "social" });
    const deps = { ...baseDeps, budgetExceeded: true };
    const result = evaluateHardGuards(intent, deps);
    assert.strictEqual(result.verdict, "deny");
    assert(result.reasons.includes("budget_exceeded"));
  });

  it("denies on risk suppressed for exploration", () => {
    const intent = makeIntent({ kind: "exploration" });
    const deps = { ...baseDeps, riskSuppressed: true };
    const result = evaluateHardGuards(intent, deps);
    assert.strictEqual(result.verdict, "deny");
    assert(result.reasons.includes("risk_suppressed"));
  });

  it("defers quiet suppression for outreach", () => {
    const intent = makeIntent({ kind: "outreach" });
    const deps = { ...baseDeps, quietBias: true };
    const result = evaluateHardGuards(intent, deps);
    assert.strictEqual(result.verdict, "defer");
    assert(result.reasons.includes("quiet_window_suppression"));
  });

  it("defers when platform not found in affordance map", () => {
    const intent = makeIntent({ platformId: "unknown_platform" });
    const result = evaluateHardGuards(intent, baseDeps);
    assert.strictEqual(result.verdict, "defer");
    assert(result.reasons.includes("affordance_unavailable"));
  });
});
