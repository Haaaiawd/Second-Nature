import { routeScopedInput } from "./scope-router.js";
const P95_MS = 2000;
export async function runHeartbeatV7(input) {
    const { signal, runtimeAvailable, deps } = input;
    // ── Scope routing ─────────────────────────────────────────────
    const payload = typeof signal.payload === "object" &&
        signal.payload !== null &&
        !Array.isArray(signal.payload)
        ? signal.payload
        : {};
    const scoped = {
        trigger: signal.trigger,
        scopeHint: signal.scopeHint,
        payload,
    };
    const route = routeScopedInput(scoped);
    // Runtime availability gate
    if (!runtimeAvailable) {
        return {
            decisionId: `decision:carrier:${Date.now()}`,
            scope: route.scope,
            status: "runtime_carrier_only",
            reasons: ["runtime_unavailable_no_lived_experience_loop"],
        };
    }
    // User task bypass
    if (route.scope === "user_task") {
        return {
            decisionId: `decision:user_task:${Date.now()}`,
            scope: "user_task",
            status: "heartbeat_ok",
            reasons: ["rhythm_gate_bypass_user_task"],
        };
    }
    // User reply light path
    if (route.scope === "user_reply") {
        return {
            decisionId: `decision:user_reply:${Date.now()}`,
            scope: "user_reply",
            status: "heartbeat_ok",
            reasons: ["user_reply_light_continuity_skeleton"],
        };
    }
    // ── Rhythm path: assemble embodied context ──────────────────
    const assemblyStart = Date.now();
    const context = await deps.assembler.assembleEmbodiedContext();
    const assemblyMs = Date.now() - assemblyStart;
    const contextId = `ctx:${Date.now()}`;
    // Build guard deps from assembled context
    const guardDeps = deps.buildGuardDeps(context);
    // Plan candidates
    const candidates = deps.planner.planCandidates(context);
    // Evaluate guards and select first allowed
    for (const intent of candidates) {
        const evaluation = deps.evaluateHardGuards(intent, guardDeps);
        if (evaluation.verdict === "allow") {
            const downstream = deps.downstreamOrchestrator.orchestrate(intent);
            const decisionId = `decision:${intent.id}:${Date.now()}`;
            const result = {
                decisionId,
                scope: "rhythm",
                status: "intent_selected",
                selectedIntentId: intent.id,
                downstreamRequestId: downstream.kind === "none"
                    ? undefined
                    : `${downstream.kind}:${decisionId}`,
                reasons: evaluation.reasons.length > 0
                    ? evaluation.reasons
                    : ["guard_allow"],
                contextId,
            };
            // P95 degradation note (does not change status per T-CP.C.2 acceptance)
            if (assemblyMs > P95_MS) {
                result.reasons.push(`heartbeat_degraded:assembly_p95_exceeded:${assemblyMs}ms`);
            }
            await safeEmitTrace(deps.traceEmitter, result, contextId);
            return result;
        }
        if (evaluation.verdict === "defer") {
            continue;
        }
        // deny / escalate → continue to next candidate
    }
    // ── No allowed candidates ────────────────────────────────────
    const decisionId = `decision:no_allow:${Date.now()}`;
    const result = {
        decisionId,
        scope: "rhythm",
        status: candidates.length === 0 ? "heartbeat_ok" : "deferred",
        reasons: candidates.length === 0
            ? ["silent_no_candidates"]
            : ["no_allow_verdict"],
        contextId,
    };
    if (assemblyMs > P95_MS) {
        result.reasons.push(`heartbeat_degraded:assembly_p95_exceeded:${assemblyMs}ms`);
    }
    await safeEmitTrace(deps.traceEmitter, result, contextId);
    return result;
}
async function safeEmitTrace(emitter, decision, contextId) {
    const trace = {
        traceId: `trace:${decision.decisionId}`,
        decisionId: decision.decisionId,
        contextId,
        scope: decision.scope,
        status: decision.status,
        reasons: decision.reasons,
        selectedIntentId: decision.selectedIntentId,
        emittedAt: new Date().toISOString(),
    };
    try {
        await emitter.emit(trace);
    }
    catch {
        // Trace emission must not block the heartbeat cycle
    }
}
