import type { StateDatabase } from "../db/index.js";
import type { IntentCommitRecord, IntentCommitRecordInput, IntentCommitState, IntentCommitOutcome } from "../../shared/types/index.js";
export interface EffectCommitStore {
    createIntentCommitRecord(input: IntentCommitRecordInput): Promise<IntentCommitRecord>;
    advanceIntentCommitState(id: string, state: IntentCommitState, metadata?: Record<string, unknown>): Promise<void>;
    commitIntentOutcome(id: string, outcome: IntentCommitOutcome): Promise<void>;
    loadIntentCommitRecord(intentId: string): Promise<IntentCommitRecord | null>;
    abortIntentCommit(id: string, reason: string): Promise<void>;
    markIntentCommitReconcile(id: string, details: Record<string, unknown>): Promise<void>;
}
export declare function createEffectCommitStore(db: StateDatabase["db"]): EffectCommitStore;
