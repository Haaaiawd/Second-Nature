import { createWorkspaceHeartbeatRunner } from "./workspace-heartbeat-runner.js";
function mapCycleToSurface(cycle, surfaceMode) {
    const status = cycle.status === "runtime_carrier_only" ? "runtime_carrier_only" : cycle.status;
    return {
        ok: true,
        status,
        surfaceMode,
        decisionId: cycle.decisionId,
        deliveryAttemptId: cycle.deliveryAttemptId,
        fallbackRef: cycle.fallbackRef,
        reasons: cycle.reasons,
        livedExperienceLoopClaimed: false,
    };
}
export async function heartbeatCheck(input) {
    if (!input.runtimeAvailable) {
        return {
            ok: true,
            status: "runtime_carrier_only",
            surfaceMode: "host_safe_carrier",
            reasons: ["runtime_unavailable_packaged_carrier"],
            livedExperienceLoopClaimed: false,
        };
    }
    if (input.probeOnly) {
        return {
            ok: true,
            status: "heartbeat_ok",
            surfaceMode: "capability_probe",
            reasons: ["probe_only"],
            livedExperienceLoopClaimed: false,
        };
    }
    if (input.fakeControlPlanePassthrough) {
        const decisionId = typeof input.fakeControlPlanePassthrough.decisionId === "string"
            ? input.fakeControlPlanePassthrough.decisionId
            : undefined;
        return {
            ok: true,
            status: "intent_selected",
            surfaceMode: "host_safe_carrier",
            reasons: ["fake_control_plane_passthrough"],
            decisionId,
            livedExperienceLoopClaimed: false,
            schemaParityOnly: true,
        };
    }
    if (!input.readModels) {
        return {
            ok: true,
            status: "runtime_carrier_only",
            surfaceMode: "host_safe_carrier",
            reasons: ["heartbeat_read_models_unavailable"],
            livedExperienceLoopClaimed: false,
        };
    }
    const timestamp = typeof input.timestamp === "string" && input.timestamp.trim().length > 0
        ? input.timestamp.trim()
        : new Date().toISOString();
    const signal = {
        trigger: "heartbeat_bridge",
        scopeHint: input.scopeHint,
        payload: {
            timestamp,
            sessionContext: typeof input.sessionContext === "string" ? input.sessionContext : undefined,
        },
    };
    const run = createWorkspaceHeartbeatRunner(input.readModels, {
        runtimeRecorder: input.runtimeRecorder,
    });
    const cycle = await run(signal);
    return mapCycleToSurface(cycle, "workspace_full_runtime");
}
