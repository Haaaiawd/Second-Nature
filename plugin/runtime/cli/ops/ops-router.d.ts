/**
 * Shared ops command dispatch for CLI + tool surfaces (T1.1.3, T1.2.2).
 */
import { type HeartbeatCheckInput, type HeartbeatSurfaceResult } from "./heartbeat-surface.js";
import { type ShowOperatorFallbackReadModels } from "./show-operator-fallback.js";
export interface OpsRouterDeps {
    /** When true, packaged runtime artifacts resolved and full graph is loadable */
    runtimeAvailable: boolean;
    /** When set, `dispatch("fallback", { ref })` returns operator fallback view (T1.2.2). */
    readModels?: ShowOperatorFallbackReadModels;
}
export interface OpsRouter {
    heartbeatCheck(input: HeartbeatCheckInput): HeartbeatSurfaceResult;
    dispatch(command: string, input?: Record<string, unknown>): HeartbeatSurfaceResult | Record<string, unknown> | Promise<Record<string, unknown>>;
}
export declare function createOpsRouter(deps: OpsRouterDeps): OpsRouter;
