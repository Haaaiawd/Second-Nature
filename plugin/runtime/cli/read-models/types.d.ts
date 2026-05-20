export interface RuntimeSummary {
    host: "openclaw-plugin";
    /**
     * T1.2.9 (SN-CODE-04): `awaiting_sources` signals that the last runtime cycle was
     * control-plane denied (decision_denied) — no eligible intent found, NOT a delivery
     * or execution fault. Operators must not interpret this as a runtime crash.
     */
    serviceStatus: "idle" | "running" | "degraded" | "awaiting_sources" | "unknown";
    updatedAt: string;
}
export interface RhythmSummary {
    mode: "active" | "quiet" | "maintenance_only" | "paused_for_interrupt" | "unknown";
    windowId?: string;
}
export interface QuietSummary {
    mode: "active" | "quiet" | "maintenance_only" | "paused_for_interrupt" | "unknown";
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
    status: "missing" | "pending_verification" | "active" | "expired" | "revoked" | "failed" | "decrypt_failed";
    nextStep?: string;
    /** T1.4.1 — diagnostic key health without leaking raw secret. */
    keyHealth?: "missing_key" | "wrong_key" | "ok";
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
    source: "workspace_default_none" | "openclaw_cron_delivery_none" | "host_capability_probe";
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
/**
 * T1.2.6 — v6 status aggregate: extends StatusReadModel with narrative, dream recent,
 * cycle recent, and per-section `nothing_yet` / `awaiting_sources` / `degraded` sentinels
 * so operators always get a meaningful view even when individual data sources are empty.
 */
export interface StatusV6NarrativeSection {
    status: "active" | "insufficient_sources" | "awaiting_sources" | "nothing_yet";
    focus: string;
    groundingStatus: "pass" | "degraded" | "blocked";
    nextIntent: string;
    sourceRefCount: number;
}
export interface StatusV6DreamSection {
    status: "has_runs" | "degraded" | "nothing_yet";
    totalRuns: number;
    recentRunCount: number;
    lastFallbackReason?: string;
}
export interface StatusV6CycleSection {
    status: "has_cycles" | "degraded" | "nothing_yet";
    totalCycles: number;
    recentCycleCount: number;
    dimensions: string[];
}
export interface StatusV6ReadModel extends StatusReadModel {
    /** v6 narrative section; status is nothing_yet when no NarrativeState row exists. */
    narrative: StatusV6NarrativeSection;
    /** v6 dream recent section; status is nothing_yet when no DreamTrace events exist. */
    dream: StatusV6DreamSection;
    /** v6 cycle recent section; status is nothing_yet when no cycle events exist. */
    cycles: StatusV6CycleSection;
}
export interface DailyReportReadModel {
    day: string;
    summary: string;
    highlights: string[];
    sourceRefs: string[];
}
export interface QuietReadModel {
    scope?: string;
    mode: "active" | "quiet" | "maintenance_only" | "paused_for_interrupt" | "unknown";
    sourceCount: number;
    reportCount: number;
    recentJournalCount: number;
    emptyStateCount?: number;
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
    status: "missing" | "pending_verification" | "active" | "expired" | "revoked" | "failed" | "decrypt_failed";
    verificationDeadline?: string;
    attemptsRemaining?: number;
    nextStep?: string;
    /**
     * T1.4.1 — redacted diagnostic: when true, the raw encrypted value could not be
     * decrypted because SECOND_NATURE_ENCRYPTION_KEY is missing or wrong.
     */
    keyHealth?: "missing_key" | "wrong_key" | "ok";
}
export type ExplainSubjectKind = "decision" | "platform-selection" | "outreach" | "soul-change" | "fallback" | "probe" | "delivery" | "report" | "source_ref" | "relationship";
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
/** T1.2.2 — recent Dream run summary for operator `dream:recent` command. */
export interface DreamRecentReadModel {
    runs: Array<{
        traceId: string;
        runId: string;
        durationMs: number;
        inputCounts: {
            evidence: number;
            chronicle: number;
            memoryEntries: number;
        };
        fallbackReason?: string;
        lifecycleStatus: string;
        insightsCount: number;
        createdAt: string;
    }>;
    totalRuns: number;
}
/** T1.2.1 — NarrativeState read model for operator `narrative` command. */
export interface NarrativeReadModel {
    narrativeId: string;
    revision: number;
    focus: string;
    progress: string[];
    nextIntent: string;
    confidence: number;
    sourceRefs: Array<{
        sourceId: string;
        kind: string;
        url?: string;
    }>;
    unsupportedClaims: string[];
    groundingStatus: "pass" | "degraded" | "blocked";
    status: "active" | "insufficient_sources" | "awaiting_sources" | "nothing_yet";
    updatedAt: string;
}
/** T1.2.5 — recent cycle summary aggregating heartbeat, narrative, dream, delivery. */
export interface CycleRecentReadModel {
    cycles: Array<{
        timestamp: string;
        dimensions: Array<"decision" | "narrative" | "dream" | "delivery" | "connector">;
        decisionOutcome?: string;
        narrativeGrounding?: string;
        dreamFallback?: string;
        deliveryStatus?: string;
    }>;
    totalCycles: number;
}
