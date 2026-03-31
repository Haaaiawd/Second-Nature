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
import type { CandidateIntent, ContinuitySnapshot, GuardEvaluation } from "../types.js";
import type { HeartbeatSignal, HeartbeatCycleResult } from "./signal.js";
import { buildContinuitySnapshot, type SnapshotInputs } from "./snapshot-builder.js";
import { planIntent } from "../orchestrator/intent-planner.js";
import { evaluateGuards } from "../orchestrator/guard-layer.js";

export interface HeartbeatDeps {
  /** Load snapshot inputs from state-system */
  loadSnapshotInputs: () => Promise<SnapshotInputs>;
}

/**
 * Ingest a heartbeat rhythm signal and drive one full decision round.
 *
 * Returns HEARTBEAT_OK when no action is warranted, or intent_selected
 * when a candidate intent passes all guards.
 */
export async function ingestRhythmSignal(
  signal: HeartbeatSignal,
  deps: HeartbeatDeps,
): Promise<HeartbeatCycleResult> {
  // Step 1: Build continuity snapshot
  const inputs = await deps.loadSnapshotInputs();
  const snapshot = buildContinuitySnapshot(inputs);

  // Step 2: Plan candidate intents
  const candidates = planIntent(snapshot);

  // Step 3: Evaluate guards for each candidate (priority order)
  for (const intent of candidates) {
    const evaluation = evaluateGuards(intent, snapshot);
    if (evaluation.verdict === "allow") {
      return {
        scope: "rhythm",
        status: "intent_selected",
        selectedIntentId: intent.id,
        reasons: evaluation.reasons,
      };
    }
  }

  // Step 4: No viable intent → HEARTBEAT_OK
  return {
    scope: "rhythm",
    status: "heartbeat_ok",
    reasons: ["no_viable_intent"],
  };
}

/**
 * Build a snapshot directly from inputs (for testing or when state-system is unavailable).
 */
export function buildSnapshotFromInputs(inputs: SnapshotInputs): ContinuitySnapshot {
  return buildContinuitySnapshot(inputs);
}
