/**
 * Heartbeat Decision Loop
 *
 * Main entry point for the heartbeat runtime. Accepts a HeartbeatSignal,
 * builds a ContinuitySnapshot, plans candidate intents, evaluates guards,
 * and returns a HeartbeatCycleResult.
 *
 * Per design doc §4.3: heartbeat round follows the sequence:
 * signal → snapshot → plan → guard → result (HEARTBEAT_OK or intent_selected)
 *
 * Per ADR-005: heartbeat is the free-rhythm main entry; this loop
 * implements the default conservative path where HEARTBEAT_OK is
 * the first-class result when no action is warranted.
 */
import type { ContinuitySnapshot } from "../types.js";
import type { HeartbeatSignal, HeartbeatCycleResult } from "./signal.js";
import { type SnapshotInputs } from "./snapshot-builder.js";
export interface HeartbeatDeps {
    /** Load snapshot inputs from state-system */
    loadSnapshotInputs: () => Promise<SnapshotInputs>;
}
/**
 * Ingest a heartbeat rhythm signal and drive one full decision round.
 *
 * Decision flow:
 * 1. Build continuity snapshot from state-system inputs
 * 2. Plan candidate intents from snapshot
 * 3. Evaluate guards for each candidate in priority order
 * 4. Return one of:
 *    - intent_selected: a candidate passed all guards
 *    - denied: candidates existed but all were rejected by guards
 *    - heartbeat_ok: no candidates or no action warranted (conservative default)
 *
 * Per ADR-005: heartbeat is the free-rhythm main entry; this loop
 * implements the default conservative path where HEARTBEAT_OK is
 * the first-class result when no action is warranted.
 */
export declare function ingestRhythmSignal(signal: HeartbeatSignal, deps: HeartbeatDeps): Promise<HeartbeatCycleResult>;
/**
 * Build a snapshot directly from inputs (for testing or when state-system is unavailable).
 */
export declare function buildSnapshotFromInputs(inputs: SnapshotInputs): ContinuitySnapshot;
