import { EffectDispatcher, buildDecisionContext } from "../orchestrator/effect-dispatcher.js";
/**
 * Map an intent kind to its guidance scene type.
 * Only generative scenes (social, outreach, explain) request guidance.
 * Maintenance, reflection, and work do not request guidance.
 */
function intentKindToScene(kind) {
    switch (kind) {
        case "social":
            return "social";
        case "outreach":
            return "outreach";
        case "exploration":
            return "explain";
        case "quiet":
            return null;
        default:
            return null;
    }
}
/**
 * Build a scene context from an allowed intent and runtime mode.
 *
 * Mode comes from the actual runtime context (active/quiet/maintenance_only/paused_for_interrupt),
 * not hardcoded.
 */
function buildSceneContext(intent, mode) {
    return {
        sceneType: intentKindToScene(intent.kind) ?? "explain",
        mode,
        sceneSummary: intent.summary,
    };
}
/**
 * Request guidance for a selected intent.
 *
 * Guidance is only requested when:
 * - The intent kind maps to a generative scene (social, outreach, explain)
 * - Maintenance, reflection, and work do not request guidance
 *
 * The guidance payload is used for context assembly within control-plane.
 * It does NOT cross the connector execution boundary.
 */
export async function requestGuidanceForIntent(intent, mode, deps) {
    const sceneType = intentKindToScene(intent.kind);
    if (!sceneType) {
        // Non-generative intents don't request guidance
        return { intent };
    }
    const sceneContext = buildSceneContext(intent, mode);
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
 * - Guidance context stays within control-plane and is NOT passed to connector executor
 *
 * The connector executor receives the original intent payload without any
 * guidance-derived fields. Guidance participates in control-plane context
 * assembly but does not leak into the connector execution boundary.
 */
export async function dispatchAllowedEffect(intent, deps) {
    const dispatcher = new EffectDispatcher(deps.leaseManager, deps.commitPort, deps.connectorExecutor, deps.checkpointPort, deps.memoryPort, deps.reflectionPort);
    const decisionContext = buildDecisionContext({
        tickId: `tick:${Date.now()}`,
        intentId: intent.id,
    });
    // Dispatch with the original intent payload.
    // Guidance context (if any) remains within control-plane boundary
    // and is NOT embedded in the connector payload.
    return dispatcher.dispatchEffect(intent, decisionContext);
}
/**
 * Full heartbeat execution: guidance bridge + allow-only effect dispatch.
 *
 * Flow:
 * 1. Check guard verdict — non-allow paths skip guidance entirely
 * 2. For allow verdict: request guidance (if generative scene), then dispatch effect
 * 3. Return execution result with guidance and dispatch info
 *
 * Per T2.2.2 boundaries:
 * - Guidance is NOT requested for deny/defer verdicts
 * - Guidance payload does NOT cross into connector execution boundary
 * - External effects only occur under allow verdict
 */
export async function executeHeartbeatCycle(intent, guardVerdict, mode, deps) {
    // Non-allow verdicts: skip guidance entirely, no effect dispatch
    if (guardVerdict !== "allow") {
        return {
            decisionId: `decision:${intent.id}:${Date.now()}`,
            intentId: intent.id,
            guardVerdict,
        };
    }
    // Allow verdict: request guidance for generative scenes, then dispatch
    const guidance = await requestGuidanceForIntent(intent, mode, deps.guidance);
    const dispatch = await dispatchAllowedEffect(intent, deps.effects);
    return {
        decisionId: `decision:${intent.id}:${Date.now()}`,
        intentId: intent.id,
        guardVerdict,
        guidance,
        dispatch,
    };
}
