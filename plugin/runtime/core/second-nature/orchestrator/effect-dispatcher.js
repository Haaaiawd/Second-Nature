import * as crypto from "crypto";
function needsLease(effectClass) {
    return (effectClass === "external_platform_action" ||
        effectClass === "connector_action" ||
        effectClass === "user_outreach");
}
function needsCheckpoint(effectClass) {
    return effectClass !== "maintenance" && effectClass !== "no_effect";
}
function isConnectorEffect(effectClass) {
    return (effectClass === "external_platform_action" ||
        effectClass === "connector_action");
}
export function toCapabilityIntent(intent) {
    if (intent.capabilityIntent?.trim())
        return intent.capabilityIntent.trim();
    if (intent.kind === "work")
        return "work.discover";
    if (intent.kind === "exploration")
        return "feed.read";
    if (intent.kind === "social")
        return "comment.reply";
    if (intent.kind === "outreach")
        return "message.send";
    if (intent.kind === "quiet")
        return "feed.read";
    return "feed.read";
}
export class EffectDispatcher {
    leaseManager;
    commitPort;
    connectorExecutor;
    checkpointPort;
    memoryPort;
    reflectionPort;
    constructor(leaseManager, commitPort, connectorExecutor, checkpointPort, memoryPort, reflectionPort) {
        this.leaseManager = leaseManager;
        this.commitPort = commitPort;
        this.connectorExecutor = connectorExecutor;
        this.checkpointPort = checkpointPort;
        this.memoryPort = memoryPort;
        this.reflectionPort = reflectionPort;
    }
    async dispatchEffect(intent, decision) {
        const lease = needsLease(intent.effectClass)
            ? await this.leaseManager.acquire(intent.effectClass, intent.platformId ?? intent.id)
            : await this.leaseManager.acquire("maintenance");
        if (!lease.granted) {
            return { status: "deferred", reason: "lease_unavailable" };
        }
        if (needsCheckpoint(intent.effectClass)) {
            await this.checkpointPort.saveCheckpoint({
                id: decision.checkpointId,
                tickId: decision.tickId,
                intentId: decision.intentId,
                phase: isConnectorEffect(intent.effectClass)
                    ? "before_effect"
                    : "before_quiet_write",
                snapshotRef: decision.traceId,
            });
        }
        const commit = await this.commitPort.createIntentCommitRecord({
            intentId: decision.intentId,
            decisionId: decision.decisionId,
            checkpointId: decision.checkpointId,
            state: "planned",
        });
        try {
            if (isConnectorEffect(intent.effectClass)) {
                await this.commitPort.advanceIntentCommitState(commit.id, "dispatched");
                const result = await this.connectorExecutor.executeEffect({
                    platformId: intent.platformId ?? "unknown",
                    intent: toCapabilityIntent(intent),
                    payload: intent.payload ?? {},
                    decisionId: decision.decisionId,
                    intentId: decision.intentId,
                    idempotencyKey: `idem:${decision.decisionId}:${decision.intentId}`,
                });
                if (result.status === "success") {
                    await this.commitPort.advanceIntentCommitState(commit.id, "externally_acknowledged", {
                        outcomeRef: result.metadata.platformId,
                    });
                    await this.commitPort.commitIntentOutcome(commit.id, {
                        traceId: decision.traceId,
                        outcomeRef: result.metadata.platformId,
                    });
                }
                else {
                    if (result.status === "retryable_failure") {
                        await this.commitPort.advanceIntentCommitState(commit.id, "reconcile", {
                            failureClass: result.failureClass,
                        });
                    }
                    else {
                        await this.commitPort.abortIntentCommit(commit.id, result.failureClass ?? "external_effect_failed");
                    }
                }
                return { status: "effect_executed", result, commitId: commit.id };
            }
            if (intent.effectClass === "memory_curation") {
                await this.commitPort.advanceIntentCommitState(commit.id, "dispatched");
                await this.memoryPort.persistCurationResult({
                    summary: intent.summary,
                    sourceRefs: [decision.traceId],
                    traceId: decision.traceId,
                });
                await this.commitPort.commitIntentOutcome(commit.id, {
                    traceId: decision.traceId,
                    outcomeRef: "memory_curation",
                });
                return { status: "curated", commitId: commit.id };
            }
            if (intent.effectClass === "narrative_reflection") {
                await this.commitPort.advanceIntentCommitState(commit.id, "dispatched");
                const reflection = await this.reflectionPort.runNarrativeReflection({
                    decisionId: decision.decisionId,
                    intentId: decision.intentId,
                    traceId: decision.traceId,
                });
                await this.commitPort.commitIntentOutcome(commit.id, {
                    traceId: decision.traceId,
                    outcomeRef: reflection.outcomeRef,
                });
                return { status: "reflected", commitId: commit.id };
            }
            await this.commitPort.advanceIntentCommitState(commit.id, "dispatched");
            await this.commitPort.commitIntentOutcome(commit.id, {
                traceId: decision.traceId,
                outcomeRef: "maintenance",
            });
            return { status: "maintenance_done", commitId: commit.id };
        }
        catch (error) {
            await this.commitPort.abortIntentCommit(commit.id, String(error));
            throw error;
        }
        finally {
            await lease.release();
        }
    }
}
export function buildDecisionContext(input) {
    const decisionId = input.decisionId ?? crypto.randomUUID();
    return {
        decisionId,
        intentId: input.intentId,
        tickId: input.tickId,
        checkpointId: `checkpoint:${input.intentId}:${Date.now()}`,
        traceId: `trace:${decisionId}`,
    };
}
