/**
 * Snapshot Builder
 *
 * Builds a ContinuitySnapshot from state-system, workspace, and runtime context.
 * This is the input preparation step for each heartbeat round.
 *
 * Per design doc §4.2: SnapshotBuilder prepares inputs for the Rhythm Engine.
 */
import type { ContinuitySnapshot, TopLevelMode } from "../types.js";

export interface SnapshotInputs {
  mode: TopLevelMode;
  currentWindowId: string;
  pendingObligations: string[];
  recentOutreachHashes: string[];
  deniedIntents: Array<{ intentHash: string; reason: string; at: string }>;
  budgets?: {
    socialUsed: number;
    socialLimit: number;
  };
  awaitingUserInput?: boolean;
  riskSuppressed?: boolean;
}

/**
 * Build a ContinuitySnapshot from loaded inputs.
 *
 * In production, inputs come from state-system (mode, budgets, obligations),
 * workspace (outreach hashes, denied intents), and runtime context (window ID).
 */
export function buildContinuitySnapshot(inputs: SnapshotInputs): ContinuitySnapshot {
  return {
    mode: inputs.mode,
    currentWindowId: inputs.currentWindowId,
    pendingObligations: inputs.pendingObligations,
    recentOutreachHashes: inputs.recentOutreachHashes,
    deniedIntents: inputs.deniedIntents,
    budgets: inputs.budgets,
    awaitingUserInput: inputs.awaitingUserInput,
    riskSuppressed: inputs.riskSuppressed,
  };
}
