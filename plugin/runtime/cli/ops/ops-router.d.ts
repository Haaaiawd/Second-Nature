import { type HeartbeatCheckInput, type HeartbeatSurfaceResult } from "./heartbeat-surface.js";
import type { SurfaceMode } from "../runtime/runtime-artifact-boundary.js";
import type { CliReadModels } from "../read-models/index.js";
import type { RuntimeDecisionRecorder } from "../../observability/services/runtime-decision-recorder.js";
import type { StateDatabase } from "../../storage/db/index.js";
import type { ObservabilityDatabase } from "../../observability/db/index.js";
import type { ConnectorExecutor } from "../../core/second-nature/orchestrator/effect-dispatcher.js";
import type { DynamicConnectorRegistry } from "../../connectors/registry/index.js";
import { type HeartbeatDigestAssemblerDeps } from "../../observability/services/heartbeat-digest-assembler.js";
import { type NarrativeTimelineDeps } from "../../observability/services/narrative-timeline-query-service.js";
import { type SecretAnchorDeps } from "../../observability/services/runtime-secret-anchor-view.js";
import { AppendOnlyAuditStore } from "../../observability/audit/append-only-audit-store.js";
import type { RestoreSnapshotStore } from "../../storage/services/restore-snapshot-store.js";
import type { CapabilityContractRegistry } from "../../connectors/base/manifest.js";
import type { AffordanceAssembler } from "../../core/second-nature/body/tool-affordance/affordance-assembler.js";
import type { EvidenceLevel } from "../../shared/types/v8-contracts.js";
/** Unified response envelope for all v7/v8 runtime-ops commands. */
export interface RuntimeOpsEnvelope<T = unknown> {
    ok: boolean;
    command: string;
    runtimeMode: "host_safe_carrier" | "workspace_full_runtime" | "unavailable";
    surfaceMode: SurfaceMode | "cli" | "openclaw_tool" | "plugin_command" | "cron_probe";
    generatedAt: string;
    data?: T;
    error?: {
        code: string;
        message: string;
        nextStep?: string;
    };
    warnings: string[];
    sourceRefs: string[];
    /** T-OBS.R.7: how strongly this response is backed by runtime proof. */
    evidenceLevel?: EvidenceLevel;
}
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
    /** Capability registry used by heartbeat planner to avoid platform/capability mismatches. */
    connectorRegistry?: CapabilityContractRegistry;
    /**
     * T1.2.3: DynamicConnectorRegistry for connector:status and connector:test commands.
     */
    registry?: DynamicConnectorRegistry;
    /**
     * In-memory audit store for heartbeat_digest, restore, and audit commands.
     * When absent, commands degrade gracefully.
     */
    auditStore?: AppendOnlyAuditStore;
    /**
     * Deps for heartbeat_digest — includes optional stateMemoryPort and deliveryAdapter.
     * When absent, only auditStore is used (no state-memory enrichment).
     */
    heartbeatDigestDeps?: Omit<HeartbeatDigestAssemblerDeps, "auditStore">;
    /**
     * Deps for narrative timeline (narrative:diff, timeline commands).
     */
    narrativeTimelineDeps?: NarrativeTimelineDeps;
    /** Port for tool_affordance command. */
    toolAffordancePort?: AffordanceAssembler;
    /**
     * Deps for runtime_secret_bootstrap (key anchor health check).
     */
    secretAnchorDeps?: SecretAnchorDeps;
    /**
     * T-ROS.C.1: RestoreSnapshotStore for bounded state restoration.
     * When absent, restore command degrades to audit-only.
     */
    restoreSnapshotStore?: RestoreSnapshotStore;
}
export interface OpsRouter {
    heartbeatCheck(input: HeartbeatCheckInput): Promise<HeartbeatSurfaceResult>;
    dispatch(command: string, input?: Record<string, unknown>): Promise<HeartbeatSurfaceResult | Record<string, unknown> | RuntimeOpsEnvelope>;
}
export declare function createOpsRouter(deps: OpsRouterDeps): OpsRouter;
