import { describe, it } from "node:test";
import assert from "node:assert";
import { createDownstreamIntentOrchestrator } from "../../../src/core/second-nature/orchestrator/downstream-intent-orchestrator.js";
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
    ...overrides,
  } as CandidateIntent;
}

describe("createDownstreamIntentOrchestrator", () => {
  it("orchestrates connector_action to connector_intent request", () => {
    const orch = createDownstreamIntentOrchestrator();
    const result = orch.orchestrate(makeIntent());
    assert.strictEqual(result.kind, "connector_intent");
    assert.strictEqual((result as any).platformId, "moltbook");
  });

  it("orchestrates user_outreach to guidance_draft request", () => {
    const orch = createDownstreamIntentOrchestrator();
    const result = orch.orchestrate(
      makeIntent({ effectClass: "user_outreach", kind: "outreach" }),
    );
    assert.strictEqual(result.kind, "guidance_draft");
  });

  it("orchestrates maintenance to none request", () => {
    const orch = createDownstreamIntentOrchestrator();
    const result = orch.orchestrate(
      makeIntent({ effectClass: "maintenance" }),
    );
    assert.strictEqual(result.kind, "none");
    assert.ok((result as any).reason.includes("no_downstream"));
  });

  it("orchestrates no_effect to none request", () => {
    const orch = createDownstreamIntentOrchestrator();
    const result = orch.orchestrate(
      makeIntent({ effectClass: "no_effect", kind: "quiet" }),
    );
    assert.strictEqual(result.kind, "none");
  });

  it("orchestrates memory_curation to dream_schedule request", () => {
    const orch = createDownstreamIntentOrchestrator();
    const result = orch.orchestrate(
      makeIntent({ effectClass: "memory_curation" }),
    );
    assert.strictEqual(result.kind, "dream_schedule");
  });

  it("orchestrates narrative_reflection to quiet_run request", () => {
    const orch = createDownstreamIntentOrchestrator();
    const result = orch.orchestrate(
      makeIntent({ effectClass: "narrative_reflection", kind: "reflection" }),
    );
    assert.strictEqual(result.kind, "quiet_run");
  });

  it("orchestrates unknown effect_class to none with reason", () => {
    const orch = createDownstreamIntentOrchestrator();
    const result = orch.orchestrate(
      makeIntent({ effectClass: "unknown_effect" as any }),
    );
    assert.strictEqual(result.kind, "none");
    assert.ok((result as any).reason.includes("unhandled"));
  });
});
