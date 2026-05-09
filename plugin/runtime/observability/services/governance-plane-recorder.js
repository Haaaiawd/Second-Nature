import { ExecutionTelemetry } from "./execution-telemetry.js";
import { GovernanceAudit } from "./governance-audit.js";
export class GovernancePlaneRecorder {
    telemetry;
    governance;
    constructor(telemetry, governance) {
        this.telemetry = telemetry;
        this.governance = governance;
    }
    async recordConnectorAttempt(audit) {
        const id = `ca-${audit.traceId}-${Date.now()}`;
        const status = audit.outcome === "failed" ? "failed" : audit.outcome === "started" ? "started" : "succeeded";
        const now = new Date().toISOString();
        const attempt = {
            id,
            traceId: audit.traceId,
            decisionId: audit.decisionId,
            intentId: audit.intentId,
            platformId: audit.platformId,
            capability: audit.capability,
            channel: audit.channel,
            status,
            failureClass: audit.failureClass,
            idempotencyKey: audit.idempotencyKey,
            metadata: {
                ...(audit.metadata ?? {}),
                ...(audit.outcome === "sampled_telemetry" ? { sampledTelemetry: true } : {}),
            },
            startedAt: now,
            finishedAt: status === "started" ? undefined : now,
        };
        await this.telemetry.recordExecutionAttempt(attempt);
        return { recordId: id, appendedAt: attempt.finishedAt ?? attempt.startedAt ?? now };
    }
    async recordStateGovernance(event) {
        const createdAt = event.createdAt ?? new Date().toISOString();
        const reason = event.decisionId !== undefined && event.decisionId.length > 0
            ? `${event.reason} decisionId=${event.decisionId}`
            : event.reason;
        await this.governance.recordOperationalGovernanceEvent({
            id: event.id,
            eventType: event.kind,
            traceId: event.traceId,
            statusTo: "recorded",
            reason,
            assetPath: event.artifactPath,
            supportingSources: event.supportingSources,
            createdAt,
        });
        return { recordId: event.id, appendedAt: createdAt };
    }
}
export function createGovernancePlaneRecorder(db) {
    return new GovernancePlaneRecorder(new ExecutionTelemetry(db), new GovernanceAudit(db));
}
