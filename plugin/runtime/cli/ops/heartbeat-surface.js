export function heartbeatCheck(input) {
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
    return {
        ok: true,
        status: "heartbeat_ok",
        surfaceMode: "workspace_full_runtime",
        reasons: ["s1_placeholder_no_decision_loop"],
        livedExperienceLoopClaimed: false,
    };
}
