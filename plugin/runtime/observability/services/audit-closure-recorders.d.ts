import type { ConnectorResult } from "../../connectors/base/contract.js";
import type { QuietArtifactAck } from "../../storage/quiet/quiet-artifact-writer.js";
import type { QuietArtifactWrite } from "../../storage/quiet/quiet-artifact-types.js";
import type { AppendOnlyAuditStore } from "../audit/append-only-audit-store.js";
export type ConnectorAttemptAuditOutcome = "success" | "failure" | "circuit_open" | "blocked";
export interface RecordConnectorAttemptAuditInput {
    auditStore?: AppendOnlyAuditStore;
    platformId: string;
    capability: string;
    result: ConnectorResult<unknown>;
    triggerSource: "manual_run" | "heartbeat";
    decisionId?: string;
    intentId?: string;
    createdAt?: string;
}
export interface RecordQuietArtifactAuditInput {
    auditStore?: AppendOnlyAuditStore;
    day: string;
    kind: QuietArtifactWrite["kind"];
    status: "completed" | "empty" | "blocked" | "failed";
    reasons: string[];
    artifactAck?: QuietArtifactAck;
    persistedRelativePath?: string;
    createdAt?: string;
}
export declare function recordConnectorAttemptAudit(input: RecordConnectorAttemptAuditInput): {
    eventId?: string;
};
export declare function recordQuietArtifactAudit(input: RecordQuietArtifactAuditInput): {
    eventId?: string;
};
