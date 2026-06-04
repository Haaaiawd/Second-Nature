/**
 * HeartbeatOrchestrator — v8 control-plane heartbeat cycle trace writer.
 *
 * Core logic: Emit ordered HeartbeatCycleTrace, invoke perception/judgment
 * ports, and return cycle result without making semantic action decisions.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/control-plane-system.md`
 * - `.anws/v8/04_SYSTEM_DESIGN/shared-v8-contracts.md §3`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (writeHeartbeatCycleTrace, readHeartbeatCycleTraces)
 * - `src/observability/loop-stage-event-sink.js` (recordLoopStageEvent)
 * - `src/core/second-nature/perception/perception-builder.js` (buildPerceptionCards)
 * - `src/core/second-nature/perception/judgment-engine.js` (runAgentJudgments)
 *
 * Boundary:
 * - Does NOT make semantic decisions about action allowability.
 * - Does NOT bypass ActionPolicyDecision.
 * - Degrades gracefully on DB failure or downstream unavailable.
 *
 * Test coverage: tests/unit/control-plane/heartbeat-cycle-trace.test.ts
 */
import type { StateDatabase } from "../../../storage/db/index.js";
import type { SourceRef, DegradedOperationResult, V8ReasonCode } from "../../../shared/types/v8-contracts.js";
export interface HeartbeatOrchestrationRequest {
    workspaceRoot: string;
    requestedAt?: string;
    trigger?: "scheduled" | "manual" | "host";
}
export interface HeartbeatOrchestrationResult {
    cycleId: string;
    cycleSequence: number;
    closureRef?: SourceRef;
    noActionReason?: V8ReasonCode;
    degraded?: DegradedOperationResult;
}
export declare function runHeartbeatCycle(db: StateDatabase, request: HeartbeatOrchestrationRequest): Promise<HeartbeatOrchestrationResult | DegradedOperationResult>;
