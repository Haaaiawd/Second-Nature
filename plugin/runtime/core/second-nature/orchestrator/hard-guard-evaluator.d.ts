/**
 * HardGuardEvaluator — T-CP.C.2
 *
 * Core logic: Applies source, affordance, circuit-breaker, dedupe, cooldown,
 * quiet, budget, risk, and privacy guards to candidate intents.
 *
 * v7 extensions over guard-layer.ts:
 * - Affordance guard: connector_action intents must map to a healthy affordance
 *   item (safe/exploratory/needs_auth). painful → connector_circuit_open defer;
 *   unavailable → affordance_unavailable defer.
 * - Source refs guard remains mandatory for all non-maintenance intents.
 *
 * Boundary:
 * - Consumes AffordanceMap from EmbodiedContext; does NOT read breaker state
 *   directly (DR-002: breaker posture flows through affordance).
 * - Guard result is final for control-plane.
 *
 * Test coverage: tests/unit/control-plane/hard-guard-evaluator.test.ts
 */
import type { CandidateIntent, GuardEvaluation } from "../types.js";
import type { AffordanceMap } from "../../../shared/types/v7-entities.js";
export interface HardGuardEvaluatorDeps {
    hasDuplicateIntent: (idempotencyKey: string) => boolean;
    isOutreachCooldownClear: (idempotencyKey: string) => boolean;
    affordanceMap?: AffordanceMap;
    quietBias?: boolean;
    budgetExceeded?: boolean;
    awaitingUser?: boolean;
    riskSuppressed?: boolean;
}
export declare function evaluateHardGuards(intent: CandidateIntent, deps: HardGuardEvaluatorDeps): GuardEvaluation;
