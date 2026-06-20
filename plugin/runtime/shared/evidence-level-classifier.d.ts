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
export declare const EVIDENCE_LEVEL_ORDER: Record<EvidenceLevel, number>;
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
export declare function classifyEvidenceLevel(input: EvidenceLevelProofInput): EvidenceLevel;
/**
 * Cap a candidate level by a maximum allowed level.
 * Used to prevent carrier/smoke proofs from masquerading as real runtime health.
 */
export declare function capEvidenceLevel(candidate: EvidenceLevel, cap: EvidenceLevel): EvidenceLevel;
/**
 * Promote a current level to a target level only if target is strictly stronger
 * and promotion is supported by supplied proof.
 */
export declare function promoteEvidenceLevel(current: EvidenceLevel, target: EvidenceLevel, proof: EvidenceLevelProofInput): EvidenceLevel;
/**
 * Aggregate multiple stage evidence levels into the minimum (weakest) level.
 * A chain is only as strong as its weakest proven stage.
 */
export declare function minEvidenceLevel(levels: EvidenceLevel[]): EvidenceLevel;
/**
 * Convenience: the strongest level achievable from the input proof set,
 * but never exceeding a hard cap.
 */
export declare function classifyAndCapEvidenceLevel(input: EvidenceLevelProofInput, cap: EvidenceLevel): EvidenceLevel;
/**
 * Map an evidence level to a human-readable operator note.
 */
export declare function evidenceLevelDescription(level: EvidenceLevel): string;
