/**
 * Shared ops command dispatch for CLI + tool surfaces (T1.1.3, T1.2.2).
 */
import { heartbeatCheck } from "./heartbeat-surface.js";
import { showOperatorFallback, OperatorFallbackNotFoundError } from "./show-operator-fallback.js";
export function createOpsRouter(deps) {
    return {
        heartbeatCheck: (input) => heartbeatCheck({
            ...input,
            runtimeAvailable: input.runtimeAvailable ?? deps.runtimeAvailable,
            readModels: input.readModels ?? deps.readModels,
        }),
        dispatch(command, input) {
            if (command === "heartbeat_check") {
                const runtimeAvailable = typeof input?.runtimeAvailable === "boolean" ? input.runtimeAvailable : deps.runtimeAvailable;
                return heartbeatCheck({
                    probeOnly: Boolean(input?.probeOnly),
                    runtimeAvailable,
                    fakeControlPlanePassthrough: input?.fakeControlPlanePassthrough && typeof input.fakeControlPlanePassthrough === "object"
                        ? input.fakeControlPlanePassthrough
                        : undefined,
                    readModels: deps.readModels,
                    timestamp: typeof input?.timestamp === "string" ? input.timestamp : undefined,
                    sessionContext: typeof input?.sessionContext === "string" ? input.sessionContext : undefined,
                    scopeHint: input?.scopeHint,
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
