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
import type { GuidancePayload, SceneContext, GuidanceFallback, GuidanceMode } from "../../../src/guidance/index.js";
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
    expressionConstraints: ["no-customer-service"],
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

test("T2.2.2 deny verdict: guidance is NOT requested", async () => {
  let guidanceRequested = false;

  const guidanceDeps: GuidanceBridgeDeps = {
    requestGuidance: async () => {
      guidanceRequested = true;
      throw new Error("Guidance should not be requested for deny verdict");
    },
    applyGuidance: () => {
      throw new Error("applyGuidance should not be called for deny verdict");
    },
  };

  const effectDeps = createMockEffectDeps();
  const intent = createAllowedIntent("social");

  const result = await executeHeartbeatCycle(intent, "deny", "active", {
    guidance: guidanceDeps,
    effects: effectDeps,
  });

  assert.equal(guidanceRequested, false, "guidance should NOT be requested for deny verdict");
  assert.equal(result.guardVerdict, "deny");
  assert.equal(result.dispatch, undefined, "no dispatch for deny verdict");
  assert.equal(result.guidance, undefined, "no guidance for deny verdict");
});

test("T2.2.2 defer verdict: guidance is NOT requested", async () => {
  let guidanceRequested = false;

  const guidanceDeps: GuidanceBridgeDeps = {
    requestGuidance: async () => {
      guidanceRequested = true;
      throw new Error("Guidance should not be requested for defer verdict");
    },
    applyGuidance: () => {
      throw new Error("applyGuidance should not be called for defer verdict");
    },
  };

  const effectDeps = createMockEffectDeps();
  const intent = createAllowedIntent("social");

  const result = await executeHeartbeatCycle(intent, "defer", "active", {
    guidance: guidanceDeps,
    effects: effectDeps,
  });

  assert.equal(guidanceRequested, false, "guidance should NOT be requested for defer verdict");
  assert.equal(result.guardVerdict, "defer");
  assert.equal(result.dispatch, undefined, "no dispatch for defer verdict");
  assert.equal(result.guidance, undefined, "no guidance for defer verdict");
});

test("T2.2.2 allow verdict: guidance is requested for generative scene (social)", async () => {
  let guidanceRequested = false;
  let requestedSceneType: string | undefined;
  let requestedMode: GuidanceMode | undefined;

  const guidanceDeps: GuidanceBridgeDeps = {
    requestGuidance: async (input) => {
      guidanceRequested = true;
      requestedSceneType = input.sceneContext.sceneType;
      requestedMode = input.sceneContext.mode;
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
      expressionConstraints: [],
    }),
  };

  const effectDeps = createMockEffectDeps();
  const intent = createAllowedIntent("social");

  const result = await executeHeartbeatCycle(intent, "allow", "quiet", {
    guidance: guidanceDeps,
    effects: effectDeps,
  });

  assert.equal(guidanceRequested, true, "guidance should be requested for allow verdict");
  assert.equal(requestedSceneType, "social");
  assert.equal(requestedMode, "quiet", "mode should come from runtime context, not hardcoded");
  assert.ok(result.guidance, "guidance result should be present");
  assert.ok(result.dispatch, "dispatch should occur for allow verdict");
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

  const effectDeps = createMockEffectDeps();
  const intent = createAllowedIntent("maintenance");

  const result = await executeHeartbeatCycle(intent, "allow", "active", {
    guidance: guidanceDeps,
    effects: effectDeps,
  });

  assert.equal(guidanceRequested, false, "guidance should NOT be requested for maintenance");
  assert.ok(result.dispatch, "dispatch should still occur for allow verdict");
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

  const effectDeps = createMockEffectDeps();
  const intent = createAllowedIntent("reflection");

  const result = await executeHeartbeatCycle(intent, "allow", "active", {
    guidance: guidanceDeps,
    effects: effectDeps,
  });

  assert.equal(guidanceRequested, false, "guidance should NOT be requested for reflection");
  assert.ok(result.dispatch, "dispatch should still occur for allow verdict");
});

test("T2.2.2 connector executor receives payload without any guidance-derived fields", async () => {
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

  await executeHeartbeatCycle(intent, "allow", "active", {
    guidance: guidanceDeps,
    effects: effectDeps,
  });

  assert.ok(connectorPayload, "connector received a payload");
  // No guidance-derived private context should leak into connector payload
  assert.ok(!("_guidanceContext" in (connectorPayload || {})), "no _guidanceContext in connector payload");
  assert.ok(!("_guidancePayload" in (connectorPayload || {})), "no _guidancePayload in connector payload");
  assert.ok(!("guidance" in (connectorPayload || {})), "no guidance field in connector payload");
});

test("T2.2.2 sceneContext.mode comes from real runtime input, not hardcoded", async () => {
  let receivedMode: GuidanceMode | undefined;

  const guidanceDeps: GuidanceBridgeDeps = {
    requestGuidance: async (input) => {
      receivedMode = input.sceneContext.mode;
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
      expressionConstraints: [],
    }),
  };

  const effectDeps = createMockEffectDeps();
  const intent = createAllowedIntent("social");

  // Test with quiet mode
  await executeHeartbeatCycle(intent, "allow", "quiet", {
    guidance: guidanceDeps,
    effects: effectDeps,
  });
  assert.equal(receivedMode, "quiet", "mode should be quiet when passed as quiet");

  // Test with maintenance_only mode
  await executeHeartbeatCycle(intent, "allow", "maintenance_only", {
    guidance: guidanceDeps,
    effects: effectDeps,
  });
  assert.equal(receivedMode, "maintenance_only", "mode should be maintenance_only when passed as such");
});

test("T2.2.2 outreach generative scene requests guidance", async () => {
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
      sceneType: "outreach",
      impulseTexts: [],
      personaRationales: [],
      outputConstraints: [],
      expressionConstraints: [],
    }),
  };

  const effectDeps = createMockEffectDeps();
  const intent = createAllowedIntent("outreach");

  const result = await executeHeartbeatCycle(intent, "allow", "active", {
    guidance: guidanceDeps,
    effects: effectDeps,
  });

  assert.equal(guidanceRequested, true, "guidance should be requested for outreach");
  assert.equal(requestedSceneType, "outreach");
  assert.ok(result.guidance, "guidance result should be present");
});

test("T2.2.2 exploration generative scene requests guidance", async () => {
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
      sceneType: "explain",
      impulseTexts: [],
      personaRationales: [],
      outputConstraints: [],
      expressionConstraints: [],
    }),
  };

  const effectDeps = createMockEffectDeps();
  const intent = createAllowedIntent("exploration");

  const result = await executeHeartbeatCycle(intent, "allow", "active", {
    guidance: guidanceDeps,
    effects: effectDeps,
  });

  assert.equal(guidanceRequested, true, "guidance should be requested for exploration");
  assert.equal(requestedSceneType, "explain");
  assert.ok(result.guidance, "guidance result should be present");
});

test("T2.2.2 maintenance non-generative path dispatches without guidance", async () => {
  const guidanceDeps = createMockGuidanceDeps();
  const effectDeps = createMockEffectDeps();
  const intent = createAllowedIntent("maintenance");

  const result = await executeHeartbeatCycle(intent, "allow", "active", {
    guidance: guidanceDeps,
    effects: effectDeps,
  });

  assert.equal(result.guardVerdict, "allow");
  assert.ok(result.dispatch, "dispatch should occur for allow verdict");
  assert.equal(result.guidance?.guidanceResult, undefined, "no guidance for maintenance");
});

test("T2.2.2 reflection non-generative path dispatches without guidance", async () => {
  const guidanceDeps = createMockGuidanceDeps();
  const effectDeps = createMockEffectDeps();
  const intent = createAllowedIntent("reflection");

  const result = await executeHeartbeatCycle(intent, "allow", "active", {
    guidance: guidanceDeps,
    effects: effectDeps,
  });

  assert.equal(result.guardVerdict, "allow");
  assert.ok(result.dispatch, "dispatch should occur for allow verdict");
  assert.equal(result.guidance?.guidanceResult, undefined, "no guidance for reflection");
});
