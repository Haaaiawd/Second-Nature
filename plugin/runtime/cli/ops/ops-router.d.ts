/**
 * Shared ops command dispatch for CLI + tool surfaces (T1.1.3).
 */
import { type HeartbeatCheckInput, type HeartbeatSurfaceResult } from "./heartbeat-surface.js";
export interface OpsRouterDeps {
    /** When true, packaged runtime artifacts resolved and full graph is loadable */
    runtimeAvailable: boolean;
}
export interface OpsRouter {
    heartbeatCheck(input: HeartbeatCheckInput): HeartbeatSurfaceResult;
    dispatch(command: string, input?: Record<string, unknown>): HeartbeatSurfaceResult | Record<string, unknown>;
}
export declare function createOpsRouter(deps: OpsRouterDeps): OpsRouter;
