/**
 * Shared ops command dispatch for CLI + tool surfaces (T1.1.3, T1.2.2).
 */
import { type HeartbeatCheckInput, type HeartbeatSurfaceResult } from "./heartbeat-surface.js";
import type { CliReadModels } from "../read-models/index.js";
import type { RuntimeDecisionRecorder } from "../../observability/services/runtime-decision-recorder.js";
import type { StateDatabase } from "../../storage/db/index.js";
import type { ObservabilityDatabase } from "../../observability/db/index.js";
import type { ConnectorExecutor } from "../../core/second-nature/orchestrator/effect-dispatcher.js";
import type { DynamicConnectorRegistry } from "../../connectors/registry/index.js";
export interface OpsRouterDeps {
    /** When true, packaged runtime artifacts resolved and full graph is loadable */
    runtimeAvailable: boolean;
    /** Workspace read models: fallback view + heartbeat decision loop inputs (T1.2.2 / US-001). */
    readModels?: CliReadModels;
    /** Persists full-runtime heartbeat cycles so `loadStatus` exits the unknown baseline (T1.2.3). */
    runtimeRecorder?: RuntimeDecisionRecorder;
    /**
     * T2.2.2: state DB + workspace root for life evidence loading in full-runtime heartbeat cycles.
     * When set, `loadSnapshotInputsForWorkspaceHeartbeat` can fill `lifeEvidenceRefs` from real DB truth.
     */
    state?: StateDatabase;
    workspaceRoot?: string;
    /**
     * T1.2.8 (SN-CODE-03): observability DB for persisting capability probe reports.
     * When absent, `capability_probe` still runs but skips persistence.
     */
    observabilityDb?: ObservabilityDatabase;
    /**
     * When present, guard-allowed connector_action intents are dispatched through the
     * connector-system instead of returning connector_dispatch_unwired.
     */
    connectorExecutor?: ConnectorExecutor;
    /**
     * T1.2.3: DynamicConnectorRegistry for connector:status and connector:test commands.
     */
    registry?: DynamicConnectorRegistry;
}
export interface OpsRouter {
    heartbeatCheck(input: HeartbeatCheckInput): Promise<HeartbeatSurfaceResult>;
    dispatch(command: string, input?: Record<string, unknown>): HeartbeatSurfaceResult | Record<string, unknown> | Promise<HeartbeatSurfaceResult> | Promise<Record<string, unknown>>;
}
export declare function createOpsRouter(deps: OpsRouterDeps): OpsRouter;
