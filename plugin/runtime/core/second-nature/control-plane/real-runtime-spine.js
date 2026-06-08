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
import { runHeartbeatCycle, } from "./heartbeat-orchestrator.js";
// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────
export async function runRealRuntimeHeartbeatCycle(options) {
    const request = {
        workspaceRoot: options.workspaceRoot,
        requestedAt: options.requestedAt,
        trigger: options.trigger ?? "scheduled",
    };
    const result = await runHeartbeatCycle(options.state, request);
    // Pass through degraded results directly
    if ("status" in result && result.status === "degraded") {
        return result;
    }
    const orchestrationResult = result;
    return {
        cycleId: orchestrationResult.cycleId,
        cycleSequence: orchestrationResult.cycleSequence,
        closureRef: orchestrationResult.closureRef,
        noActionReason: orchestrationResult.noActionReason,
        degraded: orchestrationResult.degraded,
    };
}
