/**
 * RealRuntimeSpine — Bridge real workspace heartbeat into v8 action-closure spine.
 *
 * Core logic: Wrap v8 heartbeat orchestrator for CLI/OpenClaw consumption.
 * Ensures every real heartbeat cycle writes exactly one closure/no-action
 * with state-backed persistence and canonical stage events.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/control-plane-system.md §4`
 * - `.anws/v8/04_SYSTEM_DESIGN/action-closure-policy-system.md §4.3`
 * - `.anws/v8/04_SYSTEM_DESIGN/runtime-ops-system.md §4`
 *
 * Boundary:
 * - Does NOT execute real external writes (T-CP.R.2).
 * - Does NOT register fake context-engines.
 * - Delegates all semantic decisions to action-closure-policy-system.
 */

import type { StateDatabase } from "../../../storage/db/index.js";
import {
  runHeartbeatCycle,
  type HeartbeatOrchestrationRequest,
  type HeartbeatOrchestrationResult,
} from "./heartbeat-orchestrator.js";
import type {
  SourceRef,
  DegradedOperationResult,
  V8ReasonCode,
} from "../../../shared/types/v8-contracts.js";

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

export interface RealRuntimeSpineOptions {
  workspaceRoot: string;
  state: StateDatabase;
  requestedAt?: string;
  trigger?: "scheduled" | "manual" | "host";
}

export interface RealRuntimeSpineResult {
  cycleId: string;
  cycleSequence: number;
  closureRef?: SourceRef;
  noActionReason?: V8ReasonCode;
  degraded?: DegradedOperationResult;
}

// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────

export async function runRealRuntimeHeartbeatCycle(
  options: RealRuntimeSpineOptions,
): Promise<RealRuntimeSpineResult | DegradedOperationResult> {
  const request: HeartbeatOrchestrationRequest = {
    workspaceRoot: options.workspaceRoot,
    requestedAt: options.requestedAt,
    trigger: options.trigger ?? "scheduled",
  };

  const result = await runHeartbeatCycle(options.state, request);

  // Pass through degraded results directly
  if ("status" in result && result.status === "degraded") {
    return result as DegradedOperationResult;
  }

  const orchestrationResult = result as HeartbeatOrchestrationResult;

  return {
    cycleId: orchestrationResult.cycleId,
    cycleSequence: orchestrationResult.cycleSequence,
    closureRef: orchestrationResult.closureRef,
    noActionReason: orchestrationResult.noActionReason,
    degraded: orchestrationResult.degraded,
  };
}
