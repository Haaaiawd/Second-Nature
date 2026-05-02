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
import type { ContinuitySnapshot, IntentKind } from "../types.js";
import { type SnapshotInputs } from "./snapshot-builder.js";
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
export interface HeartbeatDeps {
    /** Load snapshot inputs from state-system */
    loadSnapshotInputs: () => Promise<SnapshotInputs>;
    /** Optional observability hook (T2.2.1): one record per completed cycle. */
    recordDecisionTrace?: (payload: HeartbeatDecisionTracePayload) => Promise<void>;
}
/**
 * Ingest a heartbeat rhythm signal and drive one full decision round.
 */
export declare function ingestRhythmSignal(signal: HeartbeatSignal, deps: HeartbeatDeps): Promise<HeartbeatCycleResult>;
/**
 * Build a snapshot directly from inputs (for testing or when state-system is unavailable).
 */
export declare function buildSnapshotFromInputs(inputs: SnapshotInputs): ContinuitySnapshot;
