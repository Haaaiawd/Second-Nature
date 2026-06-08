/**
 * Audit-backed closure recorders for connector attempts and Quiet artifacts.
 *
 * Core logic: write small redacted audit envelopes for runtime actions that
 * heartbeat_digest depends on. Payloads contain outcome and source linkage only;
 * raw connector payloads and credentials are deliberately excluded.
 *
 * Dependencies: AppendOnlyAuditStore and buildAuditEnvelope hash-chain helpers.
 * Boundary: does not execute connectors, write Quiet artifacts, or mutate state.
 *
 * Test coverage: tests/unit/ops/manual-run-dispatcher.test.ts,
 * tests/unit/observability/heartbeat-digest-assembler.test.ts.
 */
import { randomUUID } from "node:crypto";
import { buildAuditEnvelope } from "../audit/audit-envelope.js";
function mapConnectorOutcome(result) {
    if (result.status === "success")
        return "success";
    if (result.failureClass === "cooldown_blocked")
        return "blocked";
    if (result.failureClass === "platform_unavailable")
        return "circuit_open";
    return "failure";
}
export function recordConnectorAttemptAudit(input) {
    if (!input.auditStore)
        return {};
    const createdAt = input.createdAt ?? new Date().toISOString();
    const family = "connector.attempt";
    const envelope = buildAuditEnvelope({
        family,
        plane: "telemetry",
        traceId: `connector_attempt:${input.triggerSource}:${randomUUID()}`,
        sequence: input.auditStore.list().length + 1,
        previousHash: input.auditStore.lastRecordHash(family),
        createdAt,
        payload: {
            platformId: input.platformId,
            capability: input.capability,
            outcome: mapConnectorOutcome(input.result),
            triggerSource: input.triggerSource,
            status: input.result.status,
            failureClass: input.result.failureClass,
            channel: input.result.metadata.channel,
            latencyMs: input.result.metadata.latencyMs,
            degraded: Boolean(input.result.metadata.degraded),
            decisionId: input.decisionId,
            intentId: input.intentId,
            createdAt,
        },
    });
    input.auditStore.append(envelope);
    return { eventId: envelope.eventId };
}
export function recordQuietArtifactAudit(input) {
    if (!input.auditStore)
        return {};
    const createdAt = input.createdAt ?? new Date().toISOString();
    const family = "source_coverage";
    const sourceRefs = input.artifactAck ? [input.artifactAck.artifactRef] : [];
    const envelope = buildAuditEnvelope({
        family,
        plane: "source_coverage",
        traceId: `quiet_artifact:${input.day}:${randomUUID()}`,
        sequence: input.auditStore.list().length + 1,
        previousHash: input.auditStore.lastRecordHash(family),
        createdAt,
        payload: {
            auditId: `quiet-audit:${input.day}:${randomUUID()}`,
            traceId: `quiet_trace:${input.day}`,
            subjectType: "quiet_artifact",
            subjectRef: input.artifactAck?.artifactRef.uri ?? `quiet:${input.day}:${input.kind}`,
            day: input.day,
            kind: input.kind,
            status: input.status,
            usedSourceRefs: sourceRefs,
            unresolvedRefs: [],
            coverageRatio: input.artifactAck?.sourceCoverage.coverageRatio ?? 0,
            unsupportedClaims: input.artifactAck?.sourceCoverage.unsupportedClaims ?? [],
            persistedRelativePath: input.persistedRelativePath,
            reasonCodes: input.reasons,
            createdAt,
        },
    });
    input.auditStore.append(envelope);
    return { eventId: envelope.eventId };
}
