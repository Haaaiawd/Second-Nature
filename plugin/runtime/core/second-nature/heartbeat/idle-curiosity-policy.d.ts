/**
 * IdleCuriosityPolicy — T-CP.C.3
 *
 * Core logic: When no active goal exists, selects at most one healthy,
 * allowlisted, read-only sensing intent from the affordance map.
 *
 * Rules:
 * - Only read-only capabilities (heuristic: intent ends with .read / .discover / .inspect / .search).
 * - Only safe or exploratory affordance status.
 * - Max one candidate per heartbeat.
 * - 1-hour cooldown per platform.
 * - No eligible connector → reason idle_policy_no_eligible_connector.
 *
 * Boundary:
 * - Does NOT execute connector.
 * - Returns a candidate descriptor, not an execution authorization.
 *
 * Test coverage: tests/unit/control-plane/idle-curiosity-policy.test.ts
 */
import type { AffordanceMap } from "../../../shared/types/v7-entities.js";
export interface IdleCuriosityCandidate {
    platformId: string;
    capabilityId: string;
    intent: string;
    reason: string;
}
export interface IdleCuriosityPolicyResult {
    candidate?: IdleCuriosityCandidate;
    reason: string;
}
export interface IdleCuriosityPolicy {
    select(affordanceMap: AffordanceMap, recentIdleHistory: {
        platformId: string;
        at: string;
    }[]): IdleCuriosityPolicyResult;
}
export declare function createIdleCuriosityPolicy(): IdleCuriosityPolicy;
