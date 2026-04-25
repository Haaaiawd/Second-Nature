import type { TopLevelMode } from "../types.js";
export interface RhythmWindow {
    id: string;
    startMinute: number;
    endMinute: number;
    mode: "active" | "quiet";
}
export interface RhythmPolicy {
    timezone: string;
    windows: RhythmWindow[];
    quietSuppressionEnabled: boolean;
}
export interface RhythmWindowDecision {
    windowId: string;
    topLevelMode: TopLevelMode;
    interrupted: boolean;
}
export declare function validateRhythmPolicy(policy: RhythmPolicy): void;
