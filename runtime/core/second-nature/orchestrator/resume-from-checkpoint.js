export async function resumeFromCheckpoint(ports, checkpointId) {
    const checkpoint = await ports.loadCheckpoint(checkpointId);
    if (!checkpoint) {
        return { status: "missing_checkpoint" };
    }
    const commitRecord = await ports.loadIntentCommitRecord(checkpoint.intentId);
    if (commitRecord?.state === "committed") {
        return { status: "already_committed", intentId: checkpoint.intentId };
    }
    if (commitRecord?.state === "externally_acknowledged") {
        return {
            status: "needs_reconcile",
            intentId: checkpoint.intentId,
            commitRecord,
        };
    }
    const snapshot = await ports.loadSnapshotByRef(checkpoint.snapshotRef);
    return {
        status: "ready_to_resume",
        checkpoint,
        snapshot,
    };
}
