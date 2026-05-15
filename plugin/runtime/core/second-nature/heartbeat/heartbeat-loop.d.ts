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
}
/**
 * Resolves the heartbeat outcome for a guard-allowed intent (outreach dispatch, quiet orchestration, or default).
 * Exported for unit tests (CR-M1 wiring).
 */
export declare function resolveAllowedIntentResult(intent: CandidateIntent, runtime: HeartbeatRuntimeSnapshot, inputs: SnapshotInputs, signal: HeartbeatSignal, deps: Pick<HeartbeatDeps, "outreachDispatch" | "quietWorkflow" | "connectorExecutor">): Promise<HeartbeatCycleResult>;
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
}
/**
 * Ingest a heartbeat rhythm signal and drive one full decision round.
 */
export declare function ingestRhythmSignal(signal: HeartbeatSignal, deps: HeartbeatDeps): Promise<HeartbeatCycleResult>;
/**
 * Build a snapshot directly from inputs (for testing or when state-system is unavailable).
 */
export declare function buildSnapshotFromInputs(inputs: SnapshotInputs): ContinuitySnapshot;
