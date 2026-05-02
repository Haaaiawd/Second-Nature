/**
 * Shared ops command dispatch for CLI + tool surfaces (T1.1.3).
 */
import { heartbeatCheck, type HeartbeatCheckInput, type HeartbeatSurfaceResult } from "./heartbeat-surface.js";

export interface OpsRouterDeps {
  /** When true, packaged runtime artifacts resolved and full graph is loadable */
  runtimeAvailable: boolean;
}

export interface OpsRouter {
  heartbeatCheck(input: HeartbeatCheckInput): HeartbeatSurfaceResult;
  dispatch(command: string, input?: Record<string, unknown>): HeartbeatSurfaceResult | Record<string, unknown>;
}

export function createOpsRouter(deps: OpsRouterDeps): OpsRouter {
  return {
    heartbeatCheck: (input) =>
      heartbeatCheck({
        ...input,
        runtimeAvailable: input.runtimeAvailable ?? deps.runtimeAvailable,
      }),
    dispatch(command, input) {
      if (command === "heartbeat_check") {
        const runtimeAvailable =
          typeof input?.runtimeAvailable === "boolean" ? input.runtimeAvailable : deps.runtimeAvailable;
        return heartbeatCheck({
          probeOnly: Boolean(input?.probeOnly),
          runtimeAvailable,
          fakeControlPlanePassthrough:
            input?.fakeControlPlanePassthrough && typeof input.fakeControlPlanePassthrough === "object"
              ? (input.fakeControlPlanePassthrough as Record<string, unknown>)
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
