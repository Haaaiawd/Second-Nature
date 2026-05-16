/**
 * Shared ops command dispatch for CLI + tool surfaces (T1.1.3, T1.2.2).
 */
import { heartbeatCheck, } from "./heartbeat-surface.js";
import { showOperatorFallback, OperatorFallbackNotFoundError, } from "./show-operator-fallback.js";
import { probeHostCapability } from "../host-capability/probe-host-capability.js";
import { recordHostCapability } from "../host-capability/record-host-capability.js";
import { runNearRealConnectorSmoke } from "../../connectors/near-real/near-real-connector-smoke.js";
import { connectorInit } from "../commands/connector-init.js";
import { connectorStatus, connectorTest } from "../commands/connector-status.js";
function coerceProbeOnlyFlag(input) {
    const v = input?.probeOnly;
    return v === true || v === "true" || v === 1 || v === "1";
}
/**
 * T1.2.8 — static local adapter: all checks return `unknown` when no real host is available.
 * Allows `capability_probe` to be called from CLI / workspace bridge without requiring a live host.
 */
function createStaticUnknownAdapter() {
    const now = new Date().toISOString();
    const unknownResult = (name) => ({
        name,
        verdict: "unknown",
        observedAt: now,
        reason: "static_local_probe_no_host_context",
        evidenceRefs: [],
    });
    return {
        checkPluginLoad: () => unknownResult("plugin_load"),
        checkHeartbeatBridge: () => unknownResult("heartbeat_bridge"),
        checkHeartbeatToolInvocation: () => unknownResult("heartbeat_tool_invocation"),
        checkDeliveryTarget: () => ({ status: "unknown", evidenceRefs: [] }),
        checkAckDropBehavior: () => unknownResult("ack_drop"),
        checkHookSupport: () => [],
    };
}
export function createOpsRouter(deps) {
    return {
        heartbeatCheck: (input) => heartbeatCheck({
            ...input,
            runtimeAvailable: input.runtimeAvailable ?? deps.runtimeAvailable,
            readModels: input.readModels ?? deps.readModels,
            runtimeRecorder: input.runtimeRecorder ?? deps.runtimeRecorder,
            state: input.state ?? deps.state,
            workspaceRoot: input.workspaceRoot ?? deps.workspaceRoot,
            connectorExecutor: input.connectorExecutor ?? deps.connectorExecutor,
        }),
        dispatch(command, input) {
            if (command === "heartbeat_check") {
                const runtimeAvailable = typeof input?.runtimeAvailable === "boolean"
                    ? input.runtimeAvailable
                    : deps.runtimeAvailable;
                return heartbeatCheck({
                    probeOnly: coerceProbeOnlyFlag(input),
                    runtimeAvailable,
                    fakeControlPlanePassthrough: input?.fakeControlPlanePassthrough &&
                        typeof input.fakeControlPlanePassthrough === "object"
                        ? input.fakeControlPlanePassthrough
                        : undefined,
                    readModels: input?.readModels ??
                        deps.readModels,
                    runtimeRecorder: input
                        ?.runtimeRecorder ?? deps.runtimeRecorder,
                    state: input?.state ??
                        deps.state,
                    workspaceRoot: input
                        ?.workspaceRoot ?? deps.workspaceRoot,
                    timestamp: typeof input?.timestamp === "string" ? input.timestamp : undefined,
                    sessionContext: typeof input?.sessionContext === "string"
                        ? input.sessionContext
                        : undefined,
                    scopeHint: input?.scopeHint,
                    connectorExecutor: input
                        ?.connectorExecutor ?? deps.connectorExecutor,
                });
            }
            if (command === "fallback") {
                const ref = typeof input?.ref === "string" ? input.ref.trim() : "";
                if (!ref) {
                    return {
                        ok: false,
                        error: {
                            code: "MISSING_FALLBACK_REF",
                            message: "fallback requires args.ref (e.g. fallback:…)",
                            requiredUserInput: ["ref"],
                            nextStep: "reinvoke_with_ref",
                        },
                    };
                }
                if (!deps.readModels?.loadFallbackView) {
                    return {
                        ok: false,
                        error: {
                            code: "FALLBACK_READ_MODEL_UNAVAILABLE",
                            message: "Operator fallback view requires workspace read models",
                            requiredUserInput: ["ref"],
                            nextStep: "wire_read_models_into_ops_router",
                        },
                    };
                }
                return (async () => {
                    try {
                        const data = await showOperatorFallback(ref, deps.readModels);
                        return { ok: true, command: "fallback", data };
                    }
                    catch (error) {
                        if (error instanceof OperatorFallbackNotFoundError) {
                            return {
                                ok: false,
                                command: "fallback",
                                error: {
                                    code: error.code,
                                    message: error.message,
                                    requiredUserInput: ["ref"],
                                    nextStep: "verify_fallback_ref_from_delivery_audit",
                                },
                            };
                        }
                        throw error;
                    }
                })();
            }
            if (command === "capability_probe") {
                // T1.2.8 (SN-CODE-03): run host capability probe with static unknown adapter (CLI context).
                // Persists report when observabilityDb is available; returns safe JSON subset.
                return (async () => {
                    const adapter = createStaticUnknownAdapter();
                    const docCheckedAt = new Date().toISOString();
                    const report = probeHostCapability({
                        adapter,
                        docLinks: [],
                        docCheckedAt,
                    });
                    if (deps.observabilityDb) {
                        await recordHostCapability(deps.observabilityDb, report);
                    }
                    return {
                        ok: true,
                        command: "capability_probe",
                        data: {
                            reportId: report.reportId,
                            generatedAt: report.generatedAt,
                            deliveryTarget: report.deliveryTarget,
                            pluginLoad: { verdict: report.pluginLoad.verdict },
                            heartbeatBridge: { verdict: report.heartbeatBridge.verdict },
                            heartbeatToolInvocation: {
                                verdict: report.heartbeatToolInvocation.verdict,
                            },
                            ackDropBehavior: { verdict: report.ackDropBehavior.verdict },
                            conflictCount: report.conflictRecords.length,
                            recommendedNextStep: report.recommendedNextStep,
                            note: "static_local_probe: all verdicts are unknown without live host context",
                        },
                    };
                })();
            }
            if (command === "near_real_smoke") {
                // T3.3.2 (SN-CODE-05): wrap runNearRealConnectorSmoke as an ops surface command.
                // Requires state + observabilityDb + workspaceRoot to be wired into OpsRouterDeps.
                if (!deps.state || !deps.observabilityDb || !deps.workspaceRoot) {
                    return {
                        ok: false,
                        command: "near_real_smoke",
                        error: {
                            code: "NEAR_REAL_SMOKE_DEPS_UNAVAILABLE",
                            message: "near_real_smoke requires state, observabilityDb, and workspaceRoot in OpsRouterDeps",
                            nextStep: "wire_deps_into_ops_router",
                        },
                    };
                }
                return (async () => {
                    const result = await runNearRealConnectorSmoke({
                        state: deps.state,
                        observabilityDb: deps.observabilityDb,
                        workspaceRoot: deps.workspaceRoot,
                    });
                    return {
                        ok: true,
                        command: "near_real_smoke",
                        data: result,
                    };
                })();
            }
            if (command === "connector_init") {
                // T1.3.1 (SN-CODE-06): generate connector manifest stub.
                return (async () => {
                    const result = await connectorInit({
                        platformId: typeof input?.platformId === "string" ? input.platformId : "",
                        family: typeof input?.family === "string"
                            ? input.family
                            : undefined,
                        displayName: typeof input?.displayName === "string" ? input.displayName : undefined,
                        runnerKind: typeof input?.runnerKind === "string"
                            ? input.runnerKind
                            : undefined,
                        force: Boolean(input?.force),
                        workspaceRoot: deps.workspaceRoot,
                    });
                    return result;
                })();
            }
            if (command === "connector_status") {
                return connectorStatus(deps.registry, undefined, {
                    includeHealth: Boolean(input?.includeHealth),
                    workspaceRoot: typeof input?.workspaceRoot === "string"
                        ? input.workspaceRoot
                        : deps.workspaceRoot,
                });
            }
            if (command === "connector_test") {
                return connectorTest(deps.registry, {
                    platformId: typeof input?.platformId === "string" ? input.platformId : "",
                    dryRun: input?.dryRun === false ? false : true, // default dry-run
                });
            }
            return {
                ok: false,
                error: {
                    code: "unknown_ops_command",
                    message: `Unknown ops command: ${command}`,
                },
            };
        },
    };
}
