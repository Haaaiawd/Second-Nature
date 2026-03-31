import test from "node:test";
import assert from "node:assert/strict";

import {
  requestGuidanceForIntent,
  dispatchAllowedEffect,
  executeHeartbeatCycle,
  type GuidanceBridgeDeps,
  type EffectDispatchDeps,
  type HeartbeatExecutorDeps,
  type GuidanceBridgeResult,
  type HeartbeatExecutionResult,
} from "../../../src/core/second-nature/heartbeat/index.js";
import type { AllowedIntent } from "../../../src/core/second-nature/orchestrator/effect-dispatcher.js";
import type { GuidancePayload, SceneContext, GuidanceFallback } from "../../../src/guidance/index.js";
import type { RequestGuidanceResult } from "../../../src/core/second-nature/guidance/request-guidance.js";
import type { AppliedGuidanceContext } from "../../../src/core/second-nature/guidance/apply-guidance.js";
import type { DispatchResult } from "../../../src/core/second-nature/orchestrator/effect-dispatcher.js";
import type { ConnectorResult } from "../../../src/connectors/base/contract.js";

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function createMockGuidanceDeps(override?: Partial<GuidanceBridgeDeps>): GuidanceBridgeDeps {
  const mockGuidancePayload: GuidancePayload = {
    scene: { sceneType: "social", mode: "active" },
    impulses: [{ kind: "social", text: "Be friendly", reviewStatus: "approved" }],
    personaReinforcement: [],
    outputGuard: { kind: "output_guard", constraints: ["no-customer-service"], hardGuardPriority: true },
  };

  const mockAppliedContext: AppliedGuidanceContext = {
    source: "guidance_payload",
    sceneType: "social",
    impulseTexts: ["Be friendly"],
    personaRationales: [],
    outputConstraints: ["no-customer-service"],
  };

  return {
    requestGuidance: async (input: { sceneContext: SceneContext }) => ({
      owner: "control-plane-system",
      sceneContext: input.sceneContext,
      guidance: mockGuidancePayload,
      usedFallback: false,
    }) as RequestGuidanceResult,
    applyGuidance: (_input: GuidancePayload | GuidanceFallback) => mockAppliedContext,
    ...override,
  };
}

function createMockEffectDeps(override?: Partial<EffectDispatchDeps>): EffectDispatchDeps {
  const mockConnectorResult: ConnectorResult<unknown> = {
    status: "success",
    metadata: { platformId: "mock", channel: "api_rest", latencyMs: 0 },
  };

  return {
    leaseManager: {
      acquire: async () => ({ granted: true, release: async () => {} }),
    } as any,
    commitPort: {
      createIntentCommitRecord: async () => ({ id: "commit-1" }),
      advanceIntentCommitState: async () => {},
      commitIntentOutcome: async () => {},
      abortIntentCommit: async () => {},
    },
    connectorExecutor: {
      executeEffect: async () => mockConnectorResult,
    },
    checkpointPort: {
      saveCheckpoint: async () => {},
    },
    memoryPort: {
      persistCurationResult: async () => {},
    },
    reflectionPort: {
      runNarrativeReflection: async () => ({ outcomeRef: "reflection-1" }),
    },
    ...override,
  };
}

function createAllowedIntent(kind: AllowedIntent["kind"]): AllowedIntent {
  return {
    id: `intent-${kind}`,
    kind,
    summary: `Test ${kind} intent`,
    effectClass: kind === "social" ? "external_platform_action" : kind === "outreach" ? "user_outreach" : "maintenance",
  };
}

// ─── T2.2.2: Guidance Bridge Tests ──────────────────────────────────────────

test("T2.2.2 allow verdict: guidance is requested for generative scene (social)", async () => {
  let guidanceRequested = false;
  let requestedSceneType: string | undefined;

  const guidanceDeps: GuidanceBridgeDeps = {
    requestGuidance: async (input) => {
      guidanceRequested = true;
      requestedSceneType = input.sceneContext.sceneType;
      return {
        owner: "control-plane-system",
        sceneContext: input.sceneContext,
        guidance: {
          scene: input.sceneContext,
          impulses: [],
          personaReinforcement: [],
          outputGuard: { kind: "output_guard", constraints: [], hardGuardPriority: true },
        } as GuidancePayload,
        usedFallback: false,
      } as RequestGuidanceResult;
    },
    applyGuidance: () => ({
      source: "guidance_payload",
      sceneType: "social",
      impulseTexts: [],
      personaRationales: [],
      outputConstraints: [],
    }),
  };

  const intent = createAllowedIntent("social");
  const result = await requestGuidanceForIntent(intent, guidanceDeps);

  assert.equal(guidanceRequested, true, "guidance should be requested for social scene");
  assert.equal(requestedSceneType, "social");
  assert.ok(result.guidanceResult, "guidance result should be present");
});

test("T2.2.2 allow verdict: guidance is NOT requested for non-generative scene (maintenance)", async () => {
  let guidanceRequested = false;

  const guidanceDeps: GuidanceBridgeDeps = {
    requestGuidance: async () => {
      guidanceRequested = true;
      throw new Error("Guidance should not be requested for maintenance");
    },
    applyGuidance: () => {
      throw new Error("applyGuidance should not be called");
    },
  };

  const intent = createAllowedIntent("maintenance");
  const result = await requestGuidanceForIntent(intent, guidanceDeps);

  assert.equal(guidanceRequested, false, "guidance should NOT be requested for maintenance");
  assert.equal(result.guidanceResult, undefined, "no guidance result for non-generative scene");
});

test("T2.2.2 allow verdict: guidance is NOT requested for reflection", async () => {
  let guidanceRequested = false;

  const guidanceDeps: GuidanceBridgeDeps = {
    requestGuidance: async () => {
      guidanceRequested = true;
      throw new Error("Guidance should not be requested for reflection");
    },
    applyGuidance: () => {
      throw new Error("applyGuidance should not be called");
    },
  };

  const intent = createAllowedIntent("reflection");
  const result = await requestGuidanceForIntent(intent, guidanceDeps);

  assert.equal(guidanceRequested, false, "guidance should NOT be requested for reflection");
});

test("T2.2.2 allow verdict: guidance payload is NOT passed to connector executor", async () => {
  let connectorPayload: Record<string, unknown> | undefined;

  const mockResult: ConnectorResult<unknown> = {
    status: "success",
    metadata: { platformId: "mock", channel: "api_rest", latencyMs: 0 },
  };

  const effectDeps: EffectDispatchDeps = {
    ...createMockEffectDeps(),
    connectorExecutor: {
      executeEffect: async (input) => {
        connectorPayload = input.payload;
        return mockResult;
      },
    },
  };

  const guidanceDeps = createMockGuidanceDeps();
  const intent = createAllowedIntent("social");
  const guidance = await requestGuidanceForIntent(intent, guidanceDeps);

  await dispatchAllowedEffect(intent, effectDeps, guidance);

  assert.ok(connectorPayload, "connector received a payload");
  assert.ok(!("_guidancePayload" in (connectorPayload || {})), "guidance payload should not be passed directly");
});

test("T2.2.2 non-allow verdict: no external effect is triggered", async () => {
  let effectDispatched = false;

  const mockResult: ConnectorResult<unknown> = {
    status: "success",
    metadata: { platformId: "mock", channel: "api_rest", latencyMs: 0 },
  };

  const effectDeps: EffectDispatchDeps = {
    ...createMockEffectDeps(),
    connectorExecutor: {
      executeEffect: async () => {
        effectDispatched = true;
        return mockResult;
      },
    },
  };

  const guidanceDeps = createMockGuidanceDeps();
  const intent = createAllowedIntent("social");

  const result = await executeHeartbeatCycle(intent, "deny", {
    guidance: guidanceDeps,
    effects: effectDeps,
  });

  assert.equal(result.guardVerdict, "deny");
  assert.equal(result.dispatch, undefined, "no dispatch for deny verdict");
  assert.equal(effectDispatched, false, "connector should not be called for deny verdict");
});

test("T2.2.2 allow verdict: effect dispatch occurs", async () => {
  let effectDispatched = false;

  const mockResult: ConnectorResult<unknown> = {
    status: "success",
    metadata: { platformId: "mock", channel: "api_rest", latencyMs: 0 },
  };

  const effectDeps: EffectDispatchDeps = {
    ...createMockEffectDeps(),
    connectorExecutor: {
      executeEffect: async () => {
        effectDispatched = true;
        return mockResult;
      },
    },
  };

  const guidanceDeps = createMockGuidanceDeps();
  const intent = createAllowedIntent("social");

  const result = await executeHeartbeatCycle(intent, "allow", {
    guidance: guidanceDeps,
    effects: effectDeps,
  });

  assert.equal(result.guardVerdict, "allow");
  assert.ok(result.dispatch, "dispatch should occur for allow verdict");
  assert.equal(effectDispatched, true, "connector should be called for allow verdict");
});

test("T2.2.2 heartbeat_ok verdict: no external effect is triggered", async () => {
  let effectDispatched = false;

  const mockResult: ConnectorResult<unknown> = {
    status: "success",
    metadata: { platformId: "mock", channel: "api_rest", latencyMs: 0 },
  };

  const effectDeps: EffectDispatchDeps = {
    ...createMockEffectDeps(),
    connectorExecutor: {
      executeEffect: async () => {
        effectDispatched = true;
        return mockResult;
      },
    },
  };

  const guidanceDeps = createMockGuidanceDeps();
  const intent = createAllowedIntent("social");

  const result = await executeHeartbeatCycle(intent, "defer", {
    guidance: guidanceDeps,
    effects: effectDeps,
  });

  assert.equal(result.dispatch, undefined, "no dispatch for defer verdict");
  assert.equal(effectDispatched, false, "connector should not be called for defer verdict");
});
