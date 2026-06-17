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

describe("runHeartbeatV7 integration", () => {
  function buildBaseDeps() {
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
      },
      evaluateHardGuards,
      buildGuardDeps: (): HardGuardEvaluatorDeps => ({
        hasDuplicateIntent: () => false,
        isOutreachCooldownClear: () => true,
        affordanceMap: {
          moltbook: [
            {
              platformId: "moltbook",
              capabilityId: "feed.read",
              intent: "feed.read",
              status: "safe",
            },
          ],
        },
      }),
      downstreamOrchestrator: createDownstreamIntentOrchestrator(),
      traceEmitter: createNoOpTraceEmitter(),
    };
  }

  function makeSignal(overrides: Partial<HeartbeatSignal> = {}): HeartbeatSignal {
    return {
      trigger: "heartbeat_bridge",
      payload: { timestamp: new Date().toISOString() },
      ...overrides,
    };
  }

  it("returns carrier_only when runtime is unavailable", async () => {
    const result = await runHeartbeatV7({
      signal: makeSignal(),
      runtimeAvailable: false,
      deps: buildBaseDeps(),
    });
    assert.strictEqual(result.status, "runtime_carrier_only");
    assert(result.reasons.includes("runtime_unavailable_no_lived_experience_loop"));
  });

  it("returns heartbeat_ok for user_task scope", async () => {
    const result = await runHeartbeatV7({
      signal: makeSignal({ trigger: "user_task" }),
      runtimeAvailable: true,
      deps: buildBaseDeps(),
    });
    assert.strictEqual(result.status, "heartbeat_ok");
    assert(result.reasons.includes("rhythm_gate_bypass_user_task"));
  });

  it("returns heartbeat_ok for user_reply scope", async () => {
    const result = await runHeartbeatV7({
      signal: makeSignal({ trigger: "user_reply" }),
      runtimeAvailable: true,
      deps: buildBaseDeps(),
    });
    assert.strictEqual(result.status, "heartbeat_ok");
    assert(result.reasons.includes("user_reply_light_continuity_skeleton"));
  });

  it("selects first allowed intent in rhythm scope", async () => {
    const result = await runHeartbeatV7({
      signal: makeSignal(),
      runtimeAvailable: true,
      deps: buildBaseDeps(),
    });
    assert.strictEqual(result.status, "intent_selected");
    assert.strictEqual(result.selectedIntentId, "intent-1");
    assert.ok(result.contextId);
    assert.ok(result.downstreamRequestId);
  });

  it("defers when affordance is painful (circuit open)", async () => {
    const deps = buildBaseDeps();
    deps.buildGuardDeps = (): HardGuardEvaluatorDeps => ({
      hasDuplicateIntent: () => false,
      isOutreachCooldownClear: () => true,
      affordanceMap: {
        moltbook: [
          {
            platformId: "moltbook",
            capabilityId: "feed.read",
            intent: "feed.read",
            status: "painful",
          },
        ],
      },
    });

    const result = await runHeartbeatV7({
      signal: makeSignal(),
      runtimeAvailable: true,
      deps,
    });
    // When all candidates are deferred, final status is deferred.
    // Per aggregate-decision semantics, final reasons contain "no_allow_verdict".
    assert.strictEqual(result.status, "deferred");
  });

  it("defers when all candidates lack source refs", async () => {
    const deps = buildBaseDeps();
    deps.planner = {
      planCandidates: (): CandidateIntent[] => [
        {
          id: "intent-bad",
          kind: "work",
          priority: 100,
          source: "tick",
          platformId: "moltbook",
          summary: "no refs",
          effectClass: "connector_action",
          sourceRefs: [],
          idempotencyKey: "key-bad",
        },
      ],
    };

    const result = await runHeartbeatV7({
      signal: makeSignal(),
      runtimeAvailable: true,
      deps,
    });
    assert.strictEqual(result.status, "deferred");
  });

  it("marks degraded when assembly exceeds P95 (simulated)", async () => {
    const deps = buildBaseDeps();
    // Empty candidates so status stays heartbeat_ok with degradation note
    deps.planner = { planCandidates: () => [] };
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
    assert(result.reasons.some((r) => r.includes("assembly_p95_exceeded")));
  });
});
