/**
 * T5.1.2 governance plane: connector attempts + state governance audit append ports.
 *
 * Core logic: connector attempts map to executionAttempts telemetry; governance kinds map to
 * governance_audit rows with traceId on target_asset_id for explain correlation.
 *
 * Test coverage: tests/unit/observability/governance-plane-recorder.test.ts
 */
import type { ObservabilityDatabase } from "../db/index.js";
import { ExecutionTelemetry } from "./execution-telemetry.js";
import { GovernanceAudit } from "./governance-audit.js";
export interface AuditAppendAck {
    recordId: string;
    appendedAt: string;
}
export type ConnectorAttemptOutcome = "started" | "succeeded" | "failed" | "sampled_telemetry";
export interface ConnectorAttemptAudit {
    traceId: string;
    decisionId: string;
    intentId: string;
    platformId: string;
    capability: string;
    channel: string;
    outcome: ConnectorAttemptOutcome;
    failureClass?: string;
    idempotencyKey?: string;
    metadata?: Record<string, unknown>;
}
export type StateGovernanceKind = "fallback_written" | "effect_commit_advanced" | "connector_failure" | "anchor_proposal_received";
export interface StateGovernanceAudit {
    id: string;
    traceId: string;
    kind: StateGovernanceKind;
    reason: string;
    decisionId?: string;
    artifactPath?: string;
    supportingSources?: string[];
    createdAt?: string;
}
export declare class GovernancePlaneRecorder {
    private readonly telemetry;
    private readonly governance;
    constructor(telemetry: ExecutionTelemetry, governance: GovernanceAudit);
    recordConnectorAttempt(audit: ConnectorAttemptAudit): Promise<AuditAppendAck>;
    recordStateGovernance(event: StateGovernanceAudit): Promise<AuditAppendAck>;
}
export declare function createGovernancePlaneRecorder(db: ObservabilityDatabase): GovernancePlaneRecorder;
