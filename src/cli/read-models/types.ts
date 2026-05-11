export interface RuntimeSummary {
  host: "openclaw-plugin";
  /**
   * T1.2.9 (SN-CODE-04): `awaiting_sources` signals that the last runtime cycle was
   * control-plane denied (decision_denied) — no eligible intent found, NOT a delivery
   * or execution fault. Operators must not interpret this as a runtime crash.
   */
  serviceStatus:
    | "idle"
    | "running"
    | "degraded"
    | "awaiting_sources"
    | "unknown";
  updatedAt: string;
}

export interface RhythmSummary {
  mode:
    | "active"
    | "quiet"
    | "maintenance_only"
    | "paused_for_interrupt"
    | "unknown";
  windowId?: string;
}

export interface QuietSummary {
  mode:
    | "active"
    | "quiet"
    | "maintenance_only"
    | "paused_for_interrupt"
    | "unknown";
  lastEvent?: string;
  interrupted?: boolean;
}

export interface ConnectorSummary {
  platformId: string;
  status: "healthy" | "degraded" | "blocked" | "unknown";
  channel?: string;
  failureClass?: string;
}

export interface CredentialSummary {
  platformId: string;
  status:
    | "missing"
    | "pending_verification"
    | "active"
    | "expired"
    | "revoked"
    | "failed";
  nextStep?: string;
}

export interface RiskSummary {
  level: "low" | "medium" | "high";
  flags: string[];
}

/**
 * T1.2.5 (CH-14-04): delivery posture summarises why `deliveryCapability.target` is `none`
 * and which layer set it — workspace heartbeat default vs OpenClaw cron config vs host probe.
 *
 * CH-15-02 implementation note: `loadStatus` currently always emits `workspace_default_none`
 * because the workspace heartbeat hardcodes `target: none` and no T1.1.2 HostCapabilityReport
 * probe is wired into the read model path yet.  The other two `source` values are reserved for
 * future integration:
 *   - `openclaw_cron_delivery_none`: when the OpenClaw cron layer exposes `delivery.mode: none`
 *     in the host config and that value is surfaced via a new probe or bridge field.
 *   - `host_capability_probe`: when `HostCapabilityReport.deliveryTarget` is read from the DB
 *     (T1.1.2) and routed into `loadStatus`.
 * Do NOT infer either value without a real observation — see ADR-007 "no proof, not sent".
 */
export interface DeliveryPosture {
  /** Current effective verdict: none = no delivery channel; available = a valid target exists. */
  verdict: "none" | "available";
  /**
   * Stable source discriminator for operator tooling (CH-15-02: only workspace_default_none
   * is emitted today; cron/probe values require additional host-side wiring):
   *   workspace_default_none — workspace heartbeat hardcodes target:none (no host probe ran).
   *   openclaw_cron_delivery_none — cron layer has delivery.mode:none (host config decision).
   *   host_capability_probe — a HostCapabilityReport probe determined the posture.
   */
  source:
    | "workspace_default_none"
    | "openclaw_cron_delivery_none"
    | "host_capability_probe";
  /** Human-readable reason code included in explain surfaces. */
  reasonCode: string;
}

export interface StatusReadModel {
  runtime: RuntimeSummary;
  rhythm: RhythmSummary;
  quiet: QuietSummary;
  connectors: ConnectorSummary[];
  credentials: CredentialSummary[];
  risk: RiskSummary;
  /**
   * T1.2.5: structured delivery posture so operators can distinguish workspace default "none"
   * from cron-layer "none" without inspecting raw heartbeat JSON.
   */
  deliveryPosture?: DeliveryPosture;
}

export interface DailyReportReadModel {
  day: string;
  summary: string;
  highlights: string[];
  sourceRefs: string[];
}

export interface QuietReadModel {
  scope?: string;
  mode:
    | "active"
    | "quiet"
    | "maintenance_only"
    | "paused_for_interrupt"
    | "unknown";
  sourceCount: number;
  reportCount: number;
  recentJournalCount: number;
}

export interface SessionDetailReadModel {
  requestedSessionId: string;
  traceId: string;
  decisionCount: number;
  attemptCount: number;
  governanceCount: number;
  keyFactors: string[];
  evidenceRefs: string[];
}

export interface CredentialReadModel {
  platformId: string;
  status:
    | "missing"
    | "pending_verification"
    | "active"
    | "expired"
    | "revoked"
    | "failed";
  verificationDeadline?: string;
  attemptsRemaining?: number;
  nextStep?: string;
}

export type ExplainSubjectKind =
  | "decision"
  | "platform-selection"
  | "outreach"
  | "soul-change"
  | "fallback"
  | "probe"
  | "delivery"
  | "report"
  | "source_ref";

export interface ExplainReadModel {
  subjectType: ExplainSubjectKind;
  conclusion: string;
  keyFactors: string[];
  evidenceRefs: string[];
  policyRefs?: string[];
  requiredUserInput?: string[];
  nextStep?: string;
  /** Operator / lived-experience audit warnings (e.g. no user-visible contact) */
  warnings?: string[];
  relatedAuditEventIds?: string[];
}

/** T1.2.7 (SN-CODE-02) — minimal audit read-side summary for operator `audit` command. */
export interface AuditEventSummaryEntry {
  eventId: string;
  family: string;
  plane: string;
  createdAt: string;
  sensitivity: string;
}

export interface AuditSummaryReadModel {
  totalEvents: number;
  events: AuditEventSummaryEntry[];
}
