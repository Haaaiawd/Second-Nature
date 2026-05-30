/**
 * Wires CLI read models into control-plane `runHeartbeatCycle` for `heartbeat_check` (US-001 / CH-09-02 / T1.2.3).
 *
 * Snapshot inputs are derived from aggregated status; delivery defaults to none until host capability is modeled here.
 *
 * T1.2.3: when a `RuntimeDecisionRecorder` is provided, persist a `sn-runtime-*` ledger row +
 * `second-nature-runtime` execution attempt after each cycle so `loadStatus` exits its `unknown`
 * baseline once the runtime has actually executed at least one full-runtime turn.
 *
 * T2.2.2: when `state` + `workspaceRoot` are supplied, call `loadLifeEvidenceSnapshot` to fill
 * `lifeEvidenceRefs`, `platformEventCount`, `workEventCount`, and `lifeEvidenceEmptyReason` on
 * `SnapshotInputs` so planner/guard paths that require source refs see real DB truth.
 * Falls back gracefully to `lifeEvidenceEmptyReason: "state_unavailable"` when state is absent.
 */
import type { HeartbeatSignal, HeartbeatCycleResult } from "../../core/second-nature/heartbeat/signal.js";
import type { SnapshotInputs } from "../../core/second-nature/heartbeat/snapshot-builder.js";
import type { CliReadModels } from "../read-models/index.js";
import type { RuntimeDecisionRecorder } from "../../observability/services/runtime-decision-recorder.js";
import type { StateDatabase } from "../../storage/db/index.js";
import type { ConnectorExecutor } from "../../core/second-nature/orchestrator/effect-dispatcher.js";
import type { CapabilityContractRegistry } from "../../connectors/base/manifest.js";
import type { AffordanceMap } from "../../shared/types/v7-entities.js";
import type { ExperienceWriter } from "../../core/second-nature/body/tool-experience/experience-writer.js";
import type { QuietDreamSchedulePort } from "../../core/second-nature/quiet/run-source-backed-quiet.js";
import { type HeartbeatDigestAssemblerDeps } from "../../observability/services/heartbeat-digest-assembler.js";
import type { GoalLifecyclePolicy } from "../../core/second-nature/heartbeat/goal-lifecycle-policy.js";
import type { IdleCuriosityPolicy } from "../../core/second-nature/heartbeat/idle-curiosity-policy.js";
import type { CircuitBreakerManager } from "../../core/second-nature/body/circuit-breaker/circuit-breaker-manager.js";
export interface WorkspaceHeartbeatRunnerOptions {
    /** When supplied, the runner persists the cycle so `loadStatus` can read it (T1.2.3). */
    runtimeRecorder?: RuntimeDecisionRecorder;
    /**
     * T2.2.2: when state + workspaceRoot are provided, life evidence is loaded from DB and merged
     * into SnapshotInputs so planner/guard paths have real source-ref truth.
     */
    state?: StateDatabase;
    workspaceRoot?: string;
    /**
     * T1.2.4: when true (and workspaceRoot is set), inject a `quietWorkflow` dep into the heartbeat
     * cycle so quiet/reflection intents can call `runSourceBackedQuiet` and write artifacts to disk.
     * Defaults to true when workspaceRoot is provided, since this is the host-safe workspace path.
     */
    enableQuietWorkflow?: boolean;
    /**
     * When present, guard-allowed connector_action intents are dispatched through the
     * connector-system instead of returning connector_dispatch_unwired.
     */
    connectorExecutor?: ConnectorExecutor;
    /**
     * T2.4.1: when present, planner resolves platform-specific intents from accepted goals
     * and connector evidence.
     */
    connectorRegistry?: CapabilityContractRegistry;
    /** v7 T-V7C.C.2: affordance map for breaker-aware guard evaluation. */
    affordanceMap?: AffordanceMap;
    /** v7 T-V7C.C.2: experience writer for heartbeat connector attempts. */
    experienceWriter?: ExperienceWriter;
    /** v7 T-V7C.C.3: when present, a successful Quiet write auto-triggers Dream scheduling. */
    dreamSchedulePort?: QuietDreamSchedulePort;
    /** v7 T-CP.C.3: goal lifecycle policy for evaluating goal transitions before planning. */
    goalLifecyclePolicy?: GoalLifecyclePolicy;
    /** v7 T-CP.C.3: idle curiosity policy for read-only sensing when no active goals exist. */
    idleCuriosityPolicy?: IdleCuriosityPolicy;
    /** v7 T-BTS.C.5: circuit breaker manager for tracking connector execution health. */
    circuitBreakerManager?: CircuitBreakerManager;
    /**
     * v7 T-V7C.C.3: when present, generates a HeartbeatDigest after each cycle
     * (inside the digest window hour, if specified) and attempts delivery.
     * Digest delivery failure is recorded as fallbackReason — never blocks the cycle.
     */
    digestOpts?: {
        assemblerDeps: HeartbeatDigestAssemblerDeps;
        /**
         * UTC hour (0–23) at which to attempt digest generation.
         * If unset, digest is generated on every cycle (for testing / always-on mode).
         */
        digestWindowHour?: number;
    };
}
export declare function loadSnapshotInputsForWorkspaceHeartbeat(readModels: CliReadModels, options?: {
    state?: StateDatabase;
    workspaceRoot?: string;
    affordanceMap?: AffordanceMap;
}): Promise<SnapshotInputs>;
export declare function createWorkspaceHeartbeatRunner(readModels: CliReadModels, options?: WorkspaceHeartbeatRunnerOptions): (signal: HeartbeatSignal) => Promise<HeartbeatCycleResult>;
