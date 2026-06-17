import { describe, it } from "node:test";
import assert from "node:assert";
import { runHeartbeatV7 } from "../../../src/core/second-nature/heartbeat/run-heartbeat-cycle-v7.js";
import { createNoOpTraceEmitter } from "../../../src/core/second-nature/heartbeat/decision-trace-emitter.js";
import { createDownstreamIntentOrchestrator } from "../../../src/core/second-nature/orchestrator/downstream-intent-orchestrator.js";
import { evaluateHardGuards } from "../../../src/core/second-nature/orchestrator/hard-guard-evaluator.js";
import type { HeartbeatSignal } from "../../../src/core/second-nature/heartbeat/signal.js";
import type { EmbodiedContext } from "../../../src/shared/types/v7-entities.js";
import type { CandidateIntent } from "../../../src/core/second-nature/types.js";
import type { HardGuardEvaluatorDeps } from "../../../src/core/second-nature/orchestrator/hard-guard-evaluator.js";

describe("runHeartbeatV7 unit", () => {
  function makeSignal(overrides: Partial<HeartbeatSignal> = {}): HeartbeatSignal {
    return {
      trigger: "heartbeat_bridge",
      payload: { timestamp: new Date().toISOString() },
      ...overrides,
    };
  }

  function makeBaseDeps() {
    return {
      assembler: {
        assembleEmbodiedContext: async (): Promise<EmbodiedContext> => ({
          identity: {
            status: "loaded",
            data: {
              profileId: "p1",
              canonicalName: "test",
              platformHandles: [],
              updatedAt: new Date().toISOString(),
            },
          },
          goals: { status: "loaded", data: [] },
          recentInteractions: { status: "loaded", data: [] },
          toolExperience: { status: "loaded", data: [] },
          acceptedDream: { status: "loaded", data: [] },
          assembledAt: new Date().toISOString(),
        }),
      },
      planner: {
        planCandidates: (): CandidateIntent[] => [],
      },
      evaluateHardGuards,
      buildGuardDeps: (): HardGuardEvaluatorDeps => ({
        hasDuplicateIntent: () => false,
        isOutreachCooldownClear: () => true,
      }),
      downstreamOrchestrator: createDownstreamIntentOrchestrator(),
      traceEmitter: createNoOpTraceEmitter(),
    };
  }

  it("returns carrier_only when runtime unavailable", async () => {
    const result = await runHeartbeatV7({
      signal: makeSignal(),
      runtimeAvailable: false,
      deps: makeBaseDeps(),
    });
    assert.strictEqual(result.status, "runtime_carrier_only");
  });

  it("returns heartbeat_ok for user_task", async () => {
    const result = await runHeartbeatV7({
      signal: makeSignal({ trigger: "user_task" }),
      runtimeAvailable: true,
      deps: makeBaseDeps(),
    });
    assert.strictEqual(result.status, "heartbeat_ok");
    assert.ok(result.reasons.includes("rhythm_gate_bypass_user_task"));
  });

  it("returns heartbeat_ok for user_reply", async () => {
    const result = await runHeartbeatV7({
      signal: makeSignal({ trigger: "user_reply" }),
      runtimeAvailable: true,
      deps: makeBaseDeps(),
    });
    assert.strictEqual(result.status, "heartbeat_ok");
    assert.ok(result.reasons.includes("user_reply_light_continuity_skeleton"));
  });

  it("returns heartbeat_ok when no candidates", async () => {
    const result = await runHeartbeatV7({
      signal: makeSignal(),
      runtimeAvailable: true,
      deps: makeBaseDeps(),
    });
    assert.strictEqual(result.status, "heartbeat_ok");
    assert.ok(result.reasons.includes("silent_no_candidates"));
  });

  it("selects first allowed intent", async () => {
    const deps = makeBaseDeps();
    deps.planner = {
      planCandidates: (): CandidateIntent[] => [
        {
          id: "intent-1",
          kind: "work",
          priority: 100,
          source: "tick",
          platformId: "moltbook",
          summary: "test work",
          effectClass: "connector_action",
          sourceRefs: [{ id: "ref-1", family: "evidence", uri: "uri://1", redactionClass: "none" }],
          idempotencyKey: "key-1",
          capabilityIntent: "feed.read",
        },
      ],
    };
    deps.buildGuardDeps = (): HardGuardEvaluatorDeps => ({
      hasDuplicateIntent: () => false,
      isOutreachCooldownClear: () => true,
      affordanceMap: {
        moltbook: [
          { platformId: "moltbook", capabilityId: "feed.read", intent: "feed.read", status: "safe" },
        ],
      },
    });

    const result = await runHeartbeatV7({
      signal: makeSignal(),
      runtimeAvailable: true,
      deps,
    });
    assert.strictEqual(result.status, "intent_selected");
    assert.strictEqual(result.selectedIntentId, "intent-1");
    assert.ok(result.downstreamRequestId);
  });

  it("degrades when assembly exceeds P95", async () => {
    const deps = makeBaseDeps();
    deps.assembler = {
      assembleEmbodiedContext: async (): Promise<EmbodiedContext> => {
        await new Promise((r) => setTimeout(r, 2100));
        return {
          identity: {
            status: "loaded",
            data: {
              profileId: "p1",
              canonicalName: "test",
              platformHandles: [],
              updatedAt: new Date().toISOString(),
            },
          },
          goals: { status: "loaded", data: [] },
          recentInteractions: { status: "loaded", data: [] },
          toolExperience: { status: "loaded", data: [] },
          acceptedDream: { status: "loaded", data: [] },
          assembledAt: new Date().toISOString(),
        };
      },
    };

    const result = await runHeartbeatV7({
      signal: makeSignal(),
      runtimeAvailable: true,
      deps,
    });
    assert.strictEqual(result.status, "heartbeat_ok");
    assert.ok(result.reasons.some((r) => r.includes("assembly_p95_exceeded")));
  });

  it("handles null payload gracefully", async () => {
    const result = await runHeartbeatV7({
      signal: { trigger: "heartbeat_bridge", payload: null as any },
      runtimeAvailable: true,
      deps: makeBaseDeps(),
    });
    assert.ok(
      result.status === "heartbeat_ok" || result.status === "runtime_carrier_only",
    );
  });

  it("handles array payload gracefully", async () => {
    const result = await runHeartbeatV7({
      signal: { trigger: "heartbeat_bridge", payload: [] as any },
      runtimeAvailable: true,
      deps: makeBaseDeps(),
    });
    assert.ok(
      result.status === "heartbeat_ok" || result.status === "runtime_carrier_only",
    );
  });
});
