export interface RuntimeSummary {
    host: "openclaw-plugin";
    serviceStatus: "idle" | "running" | "degraded" | "unknown";
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
    status: "missing" | "pending_verification" | "active" | "expired" | "revoked" | "failed";
    nextStep?: string;
}
export interface RiskSummary {
    level: "low" | "medium" | "high";
    flags: string[];
}
export interface StatusReadModel {
    runtime: RuntimeSummary;
    rhythm: RhythmSummary;
    quiet: QuietSummary;
    connectors: ConnectorSummary[];
    credentials: CredentialSummary[];
    risk: RiskSummary;
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
    status: "missing" | "pending_verification" | "active" | "expired" | "revoked" | "failed";
    verificationDeadline?: string;
    attemptsRemaining?: number;
    nextStep?: string;
}
export interface ExplainReadModel {
    subjectType: "decision" | "platform-selection" | "outreach" | "soul-change";
    conclusion: string;
    keyFactors: string[];
    evidenceRefs: string[];
    policyRefs?: string[];
    requiredUserInput?: string[];
    nextStep?: string;
}
