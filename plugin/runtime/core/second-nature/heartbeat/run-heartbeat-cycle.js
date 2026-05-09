import { ingestRhythmSignal } from "./heartbeat-loop.js";
import { routeScopedInput } from "./scope-router.js";
/**
 * Single entry for one heartbeat turn: scope routing, runtime gate, then rhythm loop if applicable.
 */
export async function runHeartbeatCycle(input) {
    const scoped = {
        trigger: input.signal.trigger,
        scopeHint: input.signal.scopeHint,
        payload: input.signal.payload,
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
