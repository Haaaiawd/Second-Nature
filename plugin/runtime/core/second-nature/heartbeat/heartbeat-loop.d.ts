/**
 * Heartbeat Decision Loop
 *
 * Main entry point for the heartbeat runtime. Accepts a HeartbeatSignal,
 * builds runtime snapshot, plans candidate intents, evaluates hard guards,
 * and returns a HeartbeatCycleResult.
 *
 * Per design doc §4.3: heartbeat round follows the sequence:
 * signal → snapshot → plan → guard → result (HEARTBEAT_OK or intent_selected)
 *
 * Per ADR-005: heartbeat is the free-rhythm main entry; this loop
 * implements the default conservative path where HEARTBEAT_OK is
 * the first-class result when no action is warranted.
 */
import type { HeartbeatSignal, HeartbeatCycleResult, HeartbeatCycleStatus, RuntimeScope, RuntimeTrigger } from "./signal.js";
import type { CandidateIntent, ContinuitySnapshot, IntentKind } from "../types.js";
import { type SnapshotInputs } from "./snapshot-builder.js";
import { type HeartbeatRuntimeSnapshot } from "./runtime-snapshot.js";
import type { GuidanceDraftPort } from "../../../guidance/outreach-draft-schema.js";
import type { StateDatabase } from "../../../storage/db/index.js";
import { type OpenClawDeliveryPort } from "../outreach/dispatch-user-outreach.js";
import type { ConnectorExecutor } from "../../../connectors/base/contract.js";
import type { CapabilityContractRegistry } from "../../../connectors/base/manifest.js";
import type { NarrativeStateStore } from "../../../storage/narrative/narrative-state-store.js";
import type { NarrativeTracePayload } from "../../../observability/services/lived-experience-audit.js";
import type { ExperienceWriter } from "../body/tool-experience/experience-writer.js";
import type { QuietDreamSchedulePort } from "../quiet/run-source-backed-quiet.js";
import type { GoalLifecyclePolicy } from "./goal-lifecycle-policy.js";
import type { IdleCuriosityPolicy } from "./idle-curiosity-policy.js";
import type { CircuitBreakerManager } from "../body/circuit-breaker/circuit-breaker-manager.js";
export interface HeartbeatDecisionTracePayload {
    scope: RuntimeScope;
    status: HeartbeatCycleStatus;
    reasons: string[];
    selectedIntentId?: string;
    rhythmWindowId: string;
    allowedIntentKinds: IntentKind[];
    candidateCount: number;
    lifeEvidenceEmpty: boolean;
    trigger: RuntimeTrigger;
}
/** Optional outreach delivery chain: when set, first allowed `user_outreach` runs dispatch (CR-M1). */
export interface HeartbeatOutreachDispatchDeps {
    state: StateDatabase;
    guidance: GuidanceDraftPort;
    delivery: OpenClawDeliveryPort;
}
/** Optional Quiet orchestration: when set, quiet/reflection allows run source-backed Quiet writer (T2.3.3). */
export interface HeartbeatQuietWorkflowDeps {
    workspaceRoot: string;
    /** v7 T-V7C.C.3: when present, a successful Quiet write auto-triggers Dream scheduling. */
    dreamSchedulePort?: QuietDreamSchedulePort;
}
/**
 * Resolves the heartbeat outcome for a guard-allowed intent (outreach dispatch, quiet orchestration, or default).
 * Exported for unit tests (CR-M1 wiring).
 */
export declare function resolveAllowedIntentResult(intent: CandidateIntent, runtime: HeartbeatRuntimeSnapshot, inputs: SnapshotInputs, signal: HeartbeatSignal, deps: Pick<HeartbeatDeps, "outreachDispatch" | "quietWorkflow" | "connectorExecutor" | "state" | "workspaceRoot" | "experienceWriter" | "circuitBreakerManager">): Promise<HeartbeatCycleResult>;
export interface HeartbeatDeps {
    /** Load snapshot inputs from state-system */
    loadSnapshotInputs: () => Promise<SnapshotInputs>;
    /** Optional observability hook (T2.2.1): one record per completed cycle. */
    recordDecisionTrace?: (payload: HeartbeatDecisionTracePayload) => Promise<void>;
    outreachDispatch?: HeartbeatOutreachDispatchDeps;
    quietWorkflow?: HeartbeatQuietWorkflowDeps;
    /**
     * When present, guard-allowed connector_action intents are dispatched
     * through the connector-system instead of returning connector_dispatch_unwired.
     */
    connectorExecutor?: ConnectorExecutor;
    /** T2.1.5: when present, heartbeat writes a source-backed NarrativeState revision after each cycle. */
    narrativeStateStore?: NarrativeStateStore;
    /** T5.1.2: when present, heartbeat records a NarrativeTrace after successful narrative state update. */
    recordNarrativeTrace?: (payload: NarrativeTracePayload) => Promise<void>;
    /** T3.3.1: when present, successful connector effects write LifeEvidence artifacts. */
    state?: StateDatabase;
    /** T3.3.1: workspace root for evidence artifact paths. */
    workspaceRoot?: string;
    /** T2.4.1: when present, planner resolves platform-specific intents. */
    connectorRegistry?: CapabilityContractRegistry;
    /** v7 T-V7C.C.2: when present, connector attempts write ToolExperience with triggerSource="heartbeat". */
    experienceWriter?: ExperienceWriter;
    /** v7 T-CP.C.3: when present, evaluates goal lifecycle transitions before candidate planning. */
    goalLifecyclePolicy?: GoalLifecyclePolicy;
    /** v7 T-CP.C.3: when present, selects read-only sensing intent when no active goals exist. */
    idleCuriosityPolicy?: IdleCuriosityPolicy;
    /** v7 T-BTS.C.5: when present, updates breaker state after connector execution. */
    circuitBreakerManager?: CircuitBreakerManager;
}
/**
 * Ingest a heartbeat rhythm signal and drive one full decision round.
 */
export declare function ingestRhythmSignal(signal: HeartbeatSignal, deps: HeartbeatDeps): Promise<HeartbeatCycleResult>;
/**
 * Build a snapshot directly from inputs (for testing or when state-system is unavailable).
 */
export declare function buildSnapshotFromInputs(inputs: SnapshotInputs): ContinuitySnapshot;
