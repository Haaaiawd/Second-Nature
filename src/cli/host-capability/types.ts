/**
 * Host capability probe contracts (cli-system v5 / ADR-007).
 *
 * Test coverage: tests/unit/cli/host-capability.test.ts, tests/integration/cli/host-capability-probe.test.ts
 */

export type DeliveryCapabilityStatus =
  | "target_available"
  | "target_none"
  | "channel_missing"
  | "host_api_unavailable"
  | "host_unsupported"
  | "unknown";

export type CapabilityVerdict = "pass" | "fail" | "unknown" | "not_applicable";

export interface SourceRef {
  id: string;
  kind:
    | "platform_item"
    | "workspace_artifact"
    | "decision_record"
    | "user_anchor"
    | "connector_result"
    | "host_report"
    | "fallback_artifact";
  uri: string;
  excerptHash?: string;
  observedAt?: string;
}

export interface HostCapabilityDocReference {
  title: string;
  url: string;
  checkedAt: string;
  documentedBehavior: string;
}

export interface HostCapabilityConflictRecord {
  capability: string;
  documentedBehavior: string;
  observedBehavior: string;
  hostVersion?: string;
  docUrl?: string;
}

export interface CapabilityCheckResult {
  name: string;
  verdict: CapabilityVerdict;
  observedAt: string;
  reason?: string;
  evidenceRefs: SourceRef[];
}

export interface HostCapabilityReport {
  reportId: string;
  generatedAt: string;
  hostVersion?: string;
  observedVersion?: string;
  docLinks: HostCapabilityDocReference[];
  docCheckedAt: string;
  pluginLoad: CapabilityCheckResult;
  heartbeatBridge: CapabilityCheckResult;
  heartbeatToolInvocation: CapabilityCheckResult;
  deliveryTarget: DeliveryCapabilityStatus;
  ackDropBehavior: CapabilityCheckResult;
  hookSupport: CapabilityCheckResult[];
  evidenceRefs: SourceRef[];
  conflictRecords: HostCapabilityConflictRecord[];
  recommendedNextStep?: string;
}

export interface HostCapabilityProbeOptions {
  adapter: HostCapabilityAdapter;
  docLinks: HostCapabilityDocReference[];
  docCheckedAt: string;
  hostVersion?: string;
  observedVersion?: string;
}

export interface HostCapabilityAdapter {
  checkPluginLoad(): CapabilityCheckResult;
  checkHeartbeatBridge(): CapabilityCheckResult;
  checkHeartbeatToolInvocation(): CapabilityCheckResult;
  /** Return normalized delivery capability as observed on the host */
  checkDeliveryTarget(): { status: DeliveryCapabilityStatus; evidenceRefs: SourceRef[]; reason?: string };
  checkAckDropBehavior(): CapabilityCheckResult;
  checkHookSupport(): CapabilityCheckResult[];
}
