import type { IntentCommitState } from "../../../shared/types/continuity.js";
export interface CheckpointRecord {
    id: string;
    intentId: string;
    snapshotRef: string;
}
export interface CommitRecord {
    id: string;
    intentId: string;
    state: IntentCommitState;
    outcomeRef?: string;
}
export type ResumeResult = {
    status: "missing_checkpoint";
} | {
    status: "already_committed";
    intentId: string;
} | {
    status: "needs_reconcile";
    intentId: string;
    commitRecord: CommitRecord;
} | {
    status: "ready_to_resume";
    checkpoint: CheckpointRecord;
    snapshot: Record<string, unknown>;
};
export interface ResumePorts {
    loadCheckpoint(checkpointId: string): Promise<CheckpointRecord | null>;
    loadIntentCommitRecord(intentId: string): Promise<CommitRecord | null>;
    loadSnapshotByRef(snapshotRef: string): Promise<Record<string, unknown>>;
}
export declare function resumeFromCheckpoint(ports: ResumePorts, checkpointId: string): Promise<ResumeResult>;
