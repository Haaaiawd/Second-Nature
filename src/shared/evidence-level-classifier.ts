/**
 * EvidenceLevelClassifier — Monotonic evidence-level taxonomy for operator-facing surfaces.
 *
 * Core logic: classify how strongly a command/response is backed by runtime proof.
 * Levels are ordered from weakest (carrier_ack) to strongest (durable_verified).
 * A level may only stay the same or increase within one command; synthetic/carrier
 * proofs can never be promoted to real_runtime or durable_verified.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/shared-v8-contracts.md §4.2, §4.3`
 * - `.anws/v8/04_SYSTEM_DESIGN/runtime-ops-system.md §2, §3.3`
 * - `.anws/v8/04_SYSTEM_DESIGN/observability-health-system.md §6.1`
 *
 * Dependencies: `src/shared/types/v8-contracts.js` (EvidenceLevel)
 * Boundary: Pure classification functions; no storage or side effects.
 * Test coverage: tests/unit/shared/evidence-level-classifier.test.ts
 */

import type { EvidenceLevel } from "./types/v8-contracts.js";

export type { EvidenceLevel };

export const EVIDENCE_LEVEL_ORDER: Record<EvidenceLevel, number> = {
  carrier_ack: 0,
  contract_smoke: 1,
  state_present: 2,
  real_runtime: 3,
  durable_verified: 4,
};

const LEVELS_BY_ORDER: EvidenceLevel[] = [
  "carrier_ack",
  "contract_smoke",
  "state_present",
  "real_runtime",
  "durable_verified",
];

export interface EvidenceLevelProofInput {
  /** Host/plugin/CLI produced an envelope but no Second Nature contract path ran. */
  hasCarrierEnvelope?: boolean;
  /** Static/fixture contract path ran without proving live state mutation. */
  hasContractSmoke?: boolean;
  /** Durable state was read or existing rows were observed. */
  hasStatePresent?: boolean;
  /** Current v8 living-loop command executed and produced stage + closure proof. */
  hasCycleExecution?: boolean;
  /** real_runtime proof was persisted and read back through normal read model. */
  hasReadbackVerification?: boolean;
}

/**
 * Classify evidence level from observed proof flags.
 * Returns the strongest level whose required proof is present.
 */
export function classifyEvidenceLevel(
  input: EvidenceLevelProofInput,
): EvidenceLevel {
  if (input.hasReadbackVerification && input.hasCycleExecution) {
    return "durable_verified";
  }
  if (input.hasCycleExecution) {
    return "real_runtime";
  }
  if (input.hasStatePresent) {
    return "state_present";
  }
  if (input.hasContractSmoke) {
    return "contract_smoke";
  }
  if (input.hasCarrierEnvelope) {
    return "carrier_ack";
  }
  // Default: carrier_ack when an envelope exists but no stronger proof was supplied.
  return "carrier_ack";
}

/**
 * Cap a candidate level by a maximum allowed level.
 * Used to prevent carrier/smoke proofs from masquerading as real runtime health.
 */
export function capEvidenceLevel(
  candidate: EvidenceLevel,
  cap: EvidenceLevel,
): EvidenceLevel {
  if (EVIDENCE_LEVEL_ORDER[candidate] <= EVIDENCE_LEVEL_ORDER[cap]) {
    return candidate;
  }
  return cap;
}

/**
 * Promote a current level to a target level only if target is strictly stronger
 * and promotion is supported by supplied proof.
 */
export function promoteEvidenceLevel(
  current: EvidenceLevel,
  target: EvidenceLevel,
  proof: EvidenceLevelProofInput,
): EvidenceLevel {
  const classified = classifyEvidenceLevel(proof);
  if (EVIDENCE_LEVEL_ORDER[classified] >= EVIDENCE_LEVEL_ORDER[target]) {
    return capEvidenceLevel(target, classified);
  }
  return current;
}

/**
 * Aggregate multiple stage evidence levels into the minimum (weakest) level.
 * A chain is only as strong as its weakest proven stage.
 */
export function minEvidenceLevel(levels: EvidenceLevel[]): EvidenceLevel {
  if (levels.length === 0) return "carrier_ack";
  let min = levels[0]!;
  for (const level of levels) {
    if (EVIDENCE_LEVEL_ORDER[level] < EVIDENCE_LEVEL_ORDER[min]) {
      min = level;
    }
  }
  return min;
}

/**
 * Convenience: the strongest level achievable from the input proof set,
 * but never exceeding a hard cap.
 */
export function classifyAndCapEvidenceLevel(
  input: EvidenceLevelProofInput,
  cap: EvidenceLevel,
): EvidenceLevel {
  return capEvidenceLevel(classifyEvidenceLevel(input), cap);
}

/**
 * Map an evidence level to a human-readable operator note.
 */
export function evidenceLevelDescription(level: EvidenceLevel): string {
  switch (level) {
    case "carrier_ack":
      return "Host/plugin returned an envelope but no Second Nature contract path ran.";
    case "contract_smoke":
      return "Static or fixture contract path passed without live state mutation.";
    case "state_present":
      return "Durable state exists or was read, but no current cycle executed.";
    case "real_runtime":
      return "Current v8 living-loop command executed and produced stage/closure proof.";
    case "durable_verified":
      return "Real runtime proof persisted and read back through the normal read model.";
    default:
      return "Unknown evidence level.";
  }
}
