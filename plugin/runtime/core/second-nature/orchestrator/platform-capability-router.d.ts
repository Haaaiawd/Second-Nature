/**
 * T2.4.1 — Platform-specific intent resolution.
 *
 * When accepted goals, narrative, or connector evidence point to a specific
 * platform, the planner emits a `CandidateIntent` with an explicit
 * `platformId`.  If the platform cannot be inferred, the caller falls
 * back to the generic connector_action path (platformId undefined).
 *
 * Boundaries:
 * - Does NOT execute connectors; only resolves platform + capability.
 * - Does NOT validate credentials; that is the guard layer's job.
 * - Optional registry: when absent, resolution is best-effort from goals/evidence.
 */
import type { IntentKind } from "../types.js";
import type { ControlPlaneSourceRef } from "../types.js";
import type { CapabilityContractRegistry } from "../../../connectors/base/manifest.js";
/** Minimal goal shape accepted by the router to avoid coupling to AgentGoal. M-03 decoupling. */
interface GoalRouterContext {
    goalId: string;
    description: string;
    completionCriteria?: string;
}
export interface PlatformResolutionContext {
    /** Accepted goals that may name a platform or capability. */
    acceptedGoals?: GoalRouterContext[];
    /** Evidence refs that may embed platform identity. */
    evidenceRefs?: ControlPlaneSourceRef[];
}
/**
 * Resolve an explicit platformId for a candidate intent kind.
 * Returns `undefined` when no unambiguous platform can be inferred.
 */
export declare function resolvePlatformForIntent(kind: IntentKind, context: PlatformResolutionContext, registry?: CapabilityContractRegistry): string | undefined;
export {};
