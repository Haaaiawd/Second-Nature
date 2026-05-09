/**
 * Maps calendar rhythm policy + continuity into planner-facing window slice (T2.1.3).
 * Control-plane owns allowedIntentKinds; state never emits them (T2.1.2 boundary).
 */
import type { ContinuitySnapshot, IntentKind } from "../types.js";
import type { RhythmPolicy } from "./rhythm-policy.js";
export interface PlannerRhythmWindowSlice {
    windowId: string;
    allowedIntentKinds: IntentKind[];
    quietBias: boolean;
}
/**
 * Derive allowed intent kinds and quiet bias for candidate planning.
 */
export declare function buildPlannerRhythmWindow(now: string, continuity: ContinuitySnapshot, policy: RhythmPolicy): PlannerRhythmWindowSlice;
