import type { StateDatabase } from "../db/index.js";
export interface RhythmPolicySnapshot {
    snapshotId: string;
    generatedAt: string;
    quietEnabled: boolean;
    socialDailyLimit: number;
    outreachDailyBudget: number;
    updatedAt: string;
}
export declare function loadRhythmPolicySnapshot(db: StateDatabase): Promise<RhythmPolicySnapshot>;
