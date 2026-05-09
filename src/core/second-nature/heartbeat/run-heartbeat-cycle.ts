/**
 * Control-plane heartbeat cycle entry (T2.1.1).
 *
 * Core logic: runtime availability gate → scope routing (user_task bypasses rhythm) →
 * rhythm path delegates to ingestRhythmSignal. Mirrors L0 control-plane-system §4.3.
 *
 * Boundaries: does not claim lived-experience completion when runtime is unavailable;
 * user_task / user_reply do not enter the rhythm candidate planner.
 */
import type { HeartbeatSignal, HeartbeatCycleResult, ScopedRuntimeInput } from "./signal.js";
import type { HeartbeatDeps } from "./heartbeat-loop.js";
import { ingestRhythmSignal } from "./heartbeat-loop.js";
import { routeScopedInput } from "./scope-router.js";

export interface RunHeartbeatCycleInput {
  signal: HeartbeatSignal;
  /** When false, return runtime_carrier_only without loading snapshots (host-safe carrier). */
  runtimeAvailable: boolean;
  deps: HeartbeatDeps;
}

/**
 * Single entry for one heartbeat turn: scope routing, runtime gate, then rhythm loop if applicable.
 */
export async function runHeartbeatCycle(input: RunHeartbeatCycleInput): Promise<HeartbeatCycleResult> {
  const scoped: ScopedRuntimeInput = {
    trigger: input.signal.trigger,
    scopeHint: input.signal.scopeHint,
    payload: input.signal.payload as Record<string, unknown>,
  };
  const route = routeScopedInput(scoped);

  if (!input.runtimeAvailable) {
    return {
      scope: route.scope,
      status: "runtime_carrier_only",
      reasons: ["runtime_unavailable_no_lived_experience_loop"],
    };
  }

  if (route.scope === "user_task") {
    return {
      scope: "user_task",
      status: "heartbeat_ok",
      reasons: ["rhythm_gate_bypass_user_task"],
    };
  }

  if (route.scope === "user_reply") {
    return {
      scope: "user_reply",
      status: "heartbeat_ok",
      reasons: ["user_reply_light_continuity_skeleton"],
    };
  }

  return ingestRhythmSignal(input.signal, input.deps);
}
