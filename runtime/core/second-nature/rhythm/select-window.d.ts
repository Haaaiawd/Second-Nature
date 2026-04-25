import type { ContinuitySnapshot } from "../types.js";
import type { RhythmPolicy, RhythmWindowDecision } from "./rhythm-policy.js";
export declare function selectRhythmWindow(now: string, snapshot: ContinuitySnapshot, policy: RhythmPolicy): RhythmWindowDecision;
