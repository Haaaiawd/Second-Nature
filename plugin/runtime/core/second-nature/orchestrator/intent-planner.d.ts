import type { CandidateIntent, ContinuitySnapshot, DecisionBasis } from "../types.js";
export declare function planIntent(snapshot: ContinuitySnapshot): CandidateIntent[];
export declare function decideDecisionBasis(intent: CandidateIntent): DecisionBasis;
