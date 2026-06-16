import { createWorkspaceHeartbeatRunner } from "./workspace-heartbeat-runner.js";
// T-CP.R.2: v8 real runtime spine bridge
import { runRealRuntimeHeartbeatCycle, } from "../../core/second-nature/control-plane/real-runtime-spine.js";
async function refreshHeartbeatImpulseContext(state, now) {
    const { assembleImpulseSync } = await import("../../guidance/impulse-assembler.js");
    const { buildExpressionBoundary } = await import("../../guidance/output-guard.js");
    const { getShortAtmosphereTemplate } = await import("../../guidance/template-registry.js");
    const { writeImpulseContext } = await import("../../core/second-nature/guidance/impulse-context-writer.js");
    const impulseResult = assembleImpulseSync({ sceneType: "heartbeat" });
    const atmosphere = getShortAtmosphereTemplate("active", "low");
    const expressionBoundary = buildExpressionBoundary("heartbeat");
    const result = await writeImpulseContext(state, {
        sceneType: "heartbeat",
        impulseResult,
        atmosphereText: atmosphere.text,
        expressionBoundaryConstraints: expressionBoundary.constraints,
        expressionBoundaryStyle: expressionBoundary.style,
    }, { now });
    return "id" in result ? result.id : undefined;
}
function mapCycleToSurface(cycle, surfaceMode) {
    const status = cycle.status === "runtime_carrier_only"
        ? "runtime_carrier_only"
        : cycle.status;
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
            sessionContext: typeof input.sessionContext === "string"
                ? input.sessionContext
                : undefined,
        },
    };
    const run = createWorkspaceHeartbeatRunner(input.readModels, {
        runtimeRecorder: input.runtimeRecorder,
        state: input.state,
        workspaceRoot: input.workspaceRoot ?? process.cwd(),
        connectorExecutor: input.connectorExecutor,
        connectorRegistry: input.connectorRegistry,
        affordanceMap: input.affordanceMap,
        experienceWriter: input.experienceWriter,
        dreamSchedulePort: input.dreamSchedulePort,
        digestOpts: input.digestOpts,
        goalLifecyclePolicy: input.goalLifecyclePolicy,
        idleCuriosityPolicy: input.idleCuriosityPolicy,
        circuitBreakerManager: input.circuitBreakerManager,
        auditStore: input.auditStore,
    });
    try {
        const cycle = await run(signal);
        const surfaceResult = mapCycleToSurface(cycle, "workspace_full_runtime");
        // T-CP.R.2: run v8 real runtime spine when enabled and state is available
        if (input.v8SpineEnabled && input.state && input.workspaceRoot) {
            try {
                const v8Result = await runRealRuntimeHeartbeatCycle({
                    workspaceRoot: input.workspaceRoot,
                    state: input.state,
                    requestedAt: timestamp,
                    trigger: "host",
                });
                if ("status" in v8Result && v8Result.status === "degraded") {
                    surfaceResult.v8Spine = {
                        cycleId: "",
                        cycleSequence: 0,
                        degradedReason: v8Result.reason,
                    };
                    surfaceResult.reasons = [
                        ...surfaceResult.reasons,
                        `v8_spine_degraded:${v8Result.reason}`,
                    ];
                }
                else {
                    const spine = v8Result;
                    const artifactId = await refreshHeartbeatImpulseContext(input.state, timestamp);
                    if (artifactId) {
                        spine.impulseContextArtifactId = artifactId;
                        surfaceResult.reasons.push(`impulse_context_refreshed:${artifactId}`);
                    }
                    surfaceResult.v8Spine = spine;
                    surfaceResult.livedExperienceLoopClaimed = Boolean(spine.cycleId && (spine.closureRef || spine.noActionReason));
                    surfaceResult.reasons = [
                        ...surfaceResult.reasons,
                        `v8_spine_cycle:${spine.cycleId}`,
                        spine.closureRef
                            ? "v8_closure_recorded"
                            : `v8_no_action:${spine.noActionReason ?? "unknown"}`,
                    ];
                }
            }
            catch (v8Err) {
                const v8Msg = v8Err instanceof Error ? v8Err.message : String(v8Err);
                surfaceResult.reasons = [
                    ...surfaceResult.reasons,
                    `v8_spine_exception:${v8Msg.slice(0, 120)}`,
                ];
            }
        }
        // T-GVS.R.1: expose impulse context artifact when state is available
        if (input.state) {
            try {
                const { readImpulseContext } = await import("../../core/second-nature/guidance/impulse-context-reader.js");
                const ctx = await readImpulseContext(input.state, "heartbeat");
                if (ctx.available) {
                    surfaceResult.impulseContext = {
                        available: true,
                        sceneType: ctx.artifact.sceneType,
                        capabilityClass: ctx.artifact.capabilityClass,
                        impulseText: ctx.artifact.impulseText,
                        atmosphereText: ctx.artifact.atmosphereText,
                        expressionBoundaryConstraints: ctx.artifact.expressionBoundaryConstraints,
                        expressionBoundaryStyle: ctx.artifact.expressionBoundaryStyle,
                        freshnessMs: ctx.freshnessMs,
                    };
                    surfaceResult.reasons.push(`impulse_context:${ctx.artifact.id}`);
                }
                else {
                    surfaceResult.impulseContext = {
                        available: false,
                        missingReason: ctx.reason,
                    };
                    surfaceResult.reasons.push(`impulse_context_missing:${ctx.reason}`);
                }
            }
            catch (readErr) {
                const msg = readErr instanceof Error ? readErr.message : String(readErr);
                surfaceResult.impulseContext = {
                    available: false,
                    missingReason: `read_exception:${msg.slice(0, 120)}`,
                };
                surfaceResult.reasons.push(`impulse_context_read_failed:${msg.slice(0, 120)}`);
            }
        }
        return surfaceResult;
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
            ok: false,
            status: "denied",
            surfaceMode: "workspace_full_runtime",
            reasons: [`heartbeat_cycle_exception:${msg.slice(0, 120)}`],
            livedExperienceLoopClaimed: false,
        };
    }
}
