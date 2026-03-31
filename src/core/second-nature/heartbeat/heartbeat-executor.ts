/**
 * Heartbeat Executor Bridge
 *
 * Connects the decision loop to guidance and effect dispatch.
 * Per T2.2.2:
 * - Guidance is only requested when a scene is selected
 * - External effects only occur under allow verdict
 * - Guidance payload participates in generative context assembly, not connector execution
 *
 * This module does NOT make guidance a decision maker:
 * - Guidance does not decide allow/deny
 * - Guidance does not replace guards
 * - Guidance does not directly drive connector executor
 */
import type { GuidancePayload, GuidanceFallback, SceneContext, GuidanceSceneType } from "../../../guidance/index.js";
import type { CandidateIntent, GuardVerdict } from "../types.js";
import { requestGuidance, type RequestGuidanceResult } from "../guidance/request-guidance.js";
import { applyGuidance, type AppliedGuidanceContext } from "../guidance/apply-guidance.js";
import { EffectDispatcher, buildDecisionContext, type AllowedIntent, type DecisionContext, type DispatchResult } from "../orchestrator/effect-dispatcher.js";
import type { LeaseManager } from "../orchestrator/lease-manager.js";
import type { IntentCommitPort, ConnectorExecutor, CheckpointPort, MemoryPort, ReflectionPort } from "../orchestrator/effect-dispatcher.js";

/**
 * Map an intent kind to its guidance scene type.
 * Only generative scenes (social, outreach, quiet, explain) request guidance.
 * Maintenance and reflection do not request guidance.
 */
function intentKindToScene(kind: CandidateIntent["kind"]): GuidanceSceneType | null {
  switch (kind) {
    case "social":
      return "social";
    case "outreach":
      return "outreach";
    case "exploration":
      return "explain";
    default:
      return null;
  }
}

/**
 * Build a scene context from an allowed intent for guidance request.
 */
function buildSceneContext(intent: AllowedIntent): SceneContext {
  return {
    sceneType: intentKindToScene(intent.kind) ?? "explain",
    mode: "active",
    sceneSummary: intent.summary,
  };
}

export interface GuidanceBridgeDeps {
  /** Request guidance from the behavioral guidance system */
  requestGuidance: typeof requestGuidance;
  /** Apply guidance payload into context */
  applyGuidance: typeof applyGuidance;
}

export interface EffectDispatchDeps {
  leaseManager: LeaseManager;
  commitPort: IntentCommitPort;
  connectorExecutor: ConnectorExecutor;
  checkpointPort: CheckpointPort;
  memoryPort: MemoryPort;
  reflectionPort: ReflectionPort;
}

export interface HeartbeatExecutorDeps {
  guidance: GuidanceBridgeDeps;
  effects: EffectDispatchDeps;
}

/**
 * Result of the guidance bridge step.
 * Guidance is only requested for generative scenes.
 */
export interface GuidanceBridgeResult {
  intent: AllowedIntent;
  guidanceResult?: RequestGuidanceResult;
  appliedContext?: AppliedGuidanceContext;
}

/**
 * Result of the full heartbeat execution cycle.
 */
export interface HeartbeatExecutionResult {
  decisionId: string;
  intentId: string;
  guardVerdict: GuardVerdict;
  guidance?: GuidanceBridgeResult;
  dispatch?: DispatchResult;
}

/**
 * Request guidance for a selected intent.
 *
 * Guidance is only requested when:
 * - The intent kind maps to a generative scene (social, outreach, explain)
 * - Maintenance, reflection, and memory_curation do not request guidance
 *
 * The guidance payload is returned for context assembly, NOT passed to connector executor.
 */
export async function requestGuidanceForIntent(
  intent: AllowedIntent,
  deps: GuidanceBridgeDeps,
): Promise<GuidanceBridgeResult> {
  const sceneType = intentKindToScene(intent.kind);
  if (!sceneType) {
    // Non-generative intents don't request guidance
    return { intent };
  }

  const sceneContext: SceneContext = buildSceneContext(intent);
  const guidanceResult = await deps.requestGuidance({ sceneContext });
  const appliedContext = deps.applyGuidance(guidanceResult.guidance);

  return {
    intent,
    guidanceResult,
    appliedContext,
  };
}

/**
 * Dispatch effects for an allowed intent.
 *
 * This function enforces the allow-only boundary:
 * - Only called when guard verdict is "allow"
 * - Creates a decision context and dispatches through EffectDispatcher
 * - Guidance context (if any) is available for generative paths but not passed to connectors
 */
export async function dispatchAllowedEffect(
  intent: AllowedIntent,
  deps: EffectDispatchDeps,
  guidance?: GuidanceBridgeResult,
): Promise<DispatchResult> {
  const dispatcher = new EffectDispatcher(
    deps.leaseManager,
    deps.commitPort,
    deps.connectorExecutor,
    deps.checkpointPort,
    deps.memoryPort,
    deps.reflectionPort,
  );

  const decisionContext = buildDecisionContext({
    tickId: `tick:${Date.now()}`,
    intentId: intent.id,
  });

  // For generative intents, guidance context is available for assembly
  // but NOT passed to connector executor
  const intentWithGuidance: AllowedIntent = guidance?.appliedContext
    ? {
        ...intent,
        payload: {
          ...intent.payload,
          _guidanceContext: {
            source: guidance.appliedContext.source,
            sceneType: guidance.appliedContext.sceneType,
            // Guidance constraints are available for context assembly
            outputConstraints: guidance.appliedContext.outputConstraints,
          },
        },
      }
    : intent;

  return dispatcher.dispatchEffect(intentWithGuidance, decisionContext);
}

/**
 * Full heartbeat execution: guidance bridge + allow-only effect dispatch.
 *
 * Flow:
 * 1. Request guidance for the selected intent (if generative scene)
 * 2. Dispatch effect (only if allow verdict - enforced by caller)
 * 3. Return execution result with guidance and dispatch info
 */
export async function executeHeartbeatCycle(
  intent: AllowedIntent,
  guardVerdict: GuardVerdict,
  deps: HeartbeatExecutorDeps,
): Promise<HeartbeatExecutionResult> {
  // Step 1: Guidance bridge (only for generative scenes)
  const guidance = await requestGuidanceForIntent(intent, deps.guidance);

  // Step 2: Effect dispatch (only for allow verdict)
  let dispatch: DispatchResult | undefined;
  if (guardVerdict === "allow") {
    dispatch = await dispatchAllowedEffect(intent, deps.effects, guidance);
  }

  return {
    decisionId: `decision:${intent.id}:${Date.now()}`,
    intentId: intent.id,
    guardVerdict,
    guidance,
    dispatch,
  };
}
