/**
 * Shared ops command dispatch for CLI + tool surfaces (T1.1.3, T1.2.2).
 */
import { type HeartbeatCheckInput, type HeartbeatSurfaceResult } from "./heartbeat-surface.js";
import type { CliReadModels } from "../read-models/index.js";
import type { RuntimeDecisionRecorder } from "../../observability/services/runtime-decision-recorder.js";
export interface OpsRouterDeps {
    /** When true, packaged runtime artifacts resolved and full graph is loadable */
    runtimeAvailable: boolean;
    /** Workspace read models: fallback view + heartbeat decision loop inputs (T1.2.2 / US-001). */
    readModels?: CliReadModels;
    /** Persists full-runtime heartbeat cycles so `loadStatus` exits the unknown baseline (T1.2.3). */
    runtimeRecorder?: RuntimeDecisionRecorder;
}
export interface OpsRouter {
    heartbeatCheck(input: HeartbeatCheckInput): Promise<HeartbeatSurfaceResult>;
    dispatch(command: string, input?: Record<string, unknown>): HeartbeatSurfaceResult | Record<string, unknown> | Promise<HeartbeatSurfaceResult> | Promise<Record<string, unknown>>;
}
export declare function createOpsRouter(deps: OpsRouterDeps): OpsRouter;
