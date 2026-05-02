/**
 * Shared ops command dispatch for CLI + tool surfaces (T1.1.3).
 */
import { heartbeatCheck } from "./heartbeat-surface.js";
export function createOpsRouter(deps) {
    return {
        heartbeatCheck: (input) => heartbeatCheck({
            ...input,
            runtimeAvailable: input.runtimeAvailable ?? deps.runtimeAvailable,
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
