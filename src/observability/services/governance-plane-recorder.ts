/**
 * T5.1.2 governance plane: connector attempts + state governance audit append ports.
 *
 * Core logic: connector attempts map to executionAttempts telemetry; governance kinds map to
 * governance_audit rows with traceId on target_asset_id for explain correlation.
 *
 * Test coverage: tests/unit/observability/governance-plane-recorder.test.ts
 */
import type { ObservabilityDatabase } from "../db/index.js";
import type { ExecutionAttempt } from "../../shared/types/continuity.js";
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

export type StateGovernanceKind =
  | "fallback_written"
  | "effect_commit_advanced"
  | "connector_failure"
  | "anchor_proposal_received";

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

export class GovernancePlaneRecorder {
  constructor(
    private readonly telemetry: ExecutionTelemetry,
    private readonly governance: GovernanceAudit,
  ) {}

  async recordConnectorAttempt(audit: ConnectorAttemptAudit): Promise<AuditAppendAck> {
    const id = `ca-${audit.traceId}-${Date.now()}`;
    const status: ExecutionAttempt["status"] =
      audit.outcome === "failed" ? "failed" : audit.outcome === "started" ? "started" : "succeeded";
    const now = new Date().toISOString();
    const attempt: ExecutionAttempt = {
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

  async recordStateGovernance(event: StateGovernanceAudit): Promise<AuditAppendAck> {
    const createdAt = event.createdAt ?? new Date().toISOString();
    const reason =
      event.decisionId !== undefined && event.decisionId.length > 0
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

export function createGovernancePlaneRecorder(db: ObservabilityDatabase): GovernancePlaneRecorder {
  return new GovernancePlaneRecorder(new ExecutionTelemetry(db), new GovernanceAudit(db));
}
