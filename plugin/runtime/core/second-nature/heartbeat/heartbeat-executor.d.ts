/**
 * Heartbeat Executor Bridge
 *
 * Connects the decision loop to guidance and effect dispatch.
 * Per T2.2.2:
 * - Guidance is only requested when an allow verdict enters a generative scene
 * - External effects only occur under allow verdict
 * - Guidance payload participates in generative context assembly within control-plane,
 *   and does NOT cross into connector execution boundary
 *
 * This module does NOT make guidance a decision maker:
 * - Guidance does not decide allow/deny
 * - Guidance does not replace guards
 * - Guidance does not directly drive connector executor
 */
import type { GuidanceMode } from "../../../guidance/index.js";
import type { GuardVerdict } from "../types.js";
import { requestGuidance, type RequestGuidanceResult } from "../guidance/request-guidance.js";
import { applyGuidance, type AppliedGuidanceContext } from "../guidance/apply-guidance.js";
import { type AllowedIntent, type DispatchResult } from "../orchestrator/effect-dispatcher.js";
import type { LeaseManager } from "../orchestrator/lease-manager.js";
import type { IntentCommitPort, ConnectorExecutor, CheckpointPort, MemoryPort, ReflectionPort } from "../orchestrator/effect-dispatcher.js";
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
 * Guidance is only requested for generative scenes under allow verdict.
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
 * - Maintenance, reflection, and work do not request guidance
 *
 * The guidance payload is used for context assembly within control-plane.
 * It does NOT cross the connector execution boundary.
 */
export declare function requestGuidanceForIntent(intent: AllowedIntent, mode: GuidanceMode, deps: GuidanceBridgeDeps): Promise<GuidanceBridgeResult>;
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
export declare function dispatchAllowedEffect(intent: AllowedIntent, deps: EffectDispatchDeps): Promise<DispatchResult>;
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
export declare function executeHeartbeatCycle(intent: AllowedIntent, guardVerdict: GuardVerdict, mode: GuidanceMode, deps: HeartbeatExecutorDeps): Promise<HeartbeatExecutionResult>;
