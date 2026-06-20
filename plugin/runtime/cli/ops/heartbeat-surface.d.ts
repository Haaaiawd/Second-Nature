/**
 * Stable HeartbeatSurfaceResult for second_nature_ops / CLI (T1.1.3, cli-system / ADR-005).
 *
 * S1 scope: carrier / probe / runtime-unavailable / fake control-plane passthrough only.
 * Workspace full runtime: delegates to `runHeartbeatCycle` when read models are wired (US-001 / CH-09-02).
 */
import type { SurfaceMode } from "../runtime/runtime-artifact-boundary.js";
import type { HeartbeatSignal } from "../../core/second-nature/heartbeat/signal.js";
import type { CliReadModels } from "../read-models/index.js";
import type { RuntimeDecisionRecorder } from "../../observability/services/runtime-decision-recorder.js";
import type { StateDatabase } from "../../storage/db/index.js";
import type { ConnectorExecutor } from "../../core/second-nature/orchestrator/effect-dispatcher.js";
import type { CapabilityContractRegistry } from "../../connectors/base/manifest.js";
import type { AffordanceMap } from "../../shared/types/v7-entities.js";
import type { ExperienceWriter } from "../../core/second-nature/body/tool-experience/experience-writer.js";
import type { QuietDreamSchedulePort } from "../../core/second-nature/quiet/run-source-backed-quiet.js";
import type { HeartbeatDigestAssemblerDeps } from "../../observability/services/heartbeat-digest-assembler.js";
import type { GoalLifecyclePolicy } from "../../core/second-nature/heartbeat/goal-lifecycle-policy.js";
import type { IdleCuriosityPolicy } from "../../core/second-nature/heartbeat/idle-curiosity-policy.js";
import type { CircuitBreakerManager } from "../../core/second-nature/body/circuit-breaker/circuit-breaker-manager.js";
import type { AppendOnlyAuditStore } from "../../observability/audit/append-only-audit-store.js";
import { type RealRuntimeSpineResult } from "../../core/second-nature/control-plane/real-runtime-spine.js";
export type HeartbeatSurfaceStatus = "heartbeat_ok" | "intent_selected" | "denied" | "deferred" | "runtime_carrier_only" | "delivery_unavailable";
export interface HeartbeatSurfaceResult {
    ok: boolean;
    status: HeartbeatSurfaceStatus;
    surfaceMode: SurfaceMode;
    decisionId?: string;
    deliveryAttemptId?: string;
    capabilityReportRef?: string;
    fallbackRef?: string;
    reasons: string[];
    /** When false, callers must not treat the round as lived-experience loop completion */
    livedExperienceLoopClaimed: boolean;
    /** True when structured fields mirror a fake adapter for schema parity only */
    schemaParityOnly?: boolean;
    /** T-CP.R.2: v8 real runtime spine result when state-backed action-closure spine ran */
    v8Spine?: RealRuntimeSpineResult & {
        degradedReason?: string;
    };
    /** T-GVS.R.1: agent-facing impulse context artifact read pointer */
    impulseContext?: {
        available: boolean;
        sceneType?: string;
        capabilityClass?: string | null;
        impulseText?: string | null;
        atmosphereText?: string | null;
        expressionBoundaryConstraints?: string[] | null;
        expressionBoundaryStyle?: string | null;
        freshnessMs?: number;
        missingReason?: string;
    };
}
export interface HeartbeatCheckInput {
    probeOnly?: boolean;
    runtimeAvailable: boolean;
    fakeControlPlanePassthrough?: Record<string, unknown>;
    /** When set, full-runtime heartbeat_check runs the control-plane decision loop (US-001). */
    readModels?: CliReadModels;
    /** When set, full-runtime cycles are persisted so `loadStatus` exits unknown (T1.2.3). */
    runtimeRecorder?: RuntimeDecisionRecorder;
    /**
     * T2.2.2: when set together with `workspaceRoot`, life evidence from the state DB is loaded
     * and merged into SnapshotInputs so planner/guard paths see real source-ref truth.
     */
    state?: StateDatabase;
    workspaceRoot?: string;
    timestamp?: string;
    sessionContext?: string;
    scopeHint?: HeartbeatSignal["scopeHint"];
    /**
     * When present, guard-allowed connector_action intents are dispatched through the
     * connector-system instead of returning connector_dispatch_unwired.
     */
    connectorExecutor?: ConnectorExecutor;
    /** Capability registry used by planner to avoid platform/capability protocol mismatches. */
    connectorRegistry?: CapabilityContractRegistry;
    /** v7 T-V7C.C.2: affordance map for breaker-aware guard evaluation. */
    affordanceMap?: AffordanceMap;
    /** v7 T-V7C.C.2: experience writer for heartbeat connector attempts. */
    experienceWriter?: ExperienceWriter;
    /**
     * v7 T-V7C.C.6: when present, a successful Quiet write auto-triggers Dream scheduling.
     * Fixes the production-data gap where dream_output_index does not grow after Quiet.
     */
    dreamSchedulePort?: QuietDreamSchedulePort;
    /**
     * v7 T-V7C.C.6: when present, generates a HeartbeatDigest after each cycle.
     * Fixes the production-data gap where heartbeat_digest does not grow.
     */
    digestOpts?: {
        assemblerDeps: HeartbeatDigestAssemblerDeps;
        digestWindowHour?: number;
    };
    /** v7 T-CP.C.3: goal lifecycle policy for evaluating goal transitions. */
    goalLifecyclePolicy?: GoalLifecyclePolicy;
    /** v7 T-CP.C.3: idle curiosity policy for read-only sensing when no active goals. */
    idleCuriosityPolicy?: IdleCuriosityPolicy;
    /** v7 T-BTS.C.5: circuit breaker manager for connector execution health. */
    circuitBreakerManager?: CircuitBreakerManager;
    /** T-OBS.R.1: shared audit sink for connector/Quiet events consumed by heartbeat_digest. */
    auditStore?: AppendOnlyAuditStore;
    /**
     * T-CP.R.5: v8 living-loop spine is the default operator-facing heartbeat model.
     * Explicit false can be used by legacy callers to force a carrier-only path.
     */
    v8SpineEnabled?: boolean;
}
export declare function heartbeatCheck(input: HeartbeatCheckInput): Promise<HeartbeatSurfaceResult>;
