import type { StateDatabase } from "../../storage/db/index.js";
import type { ObservabilityDatabase } from "../../observability/db/index.js";
import { AppendOnlyAuditStore } from "../../observability/audit/append-only-audit-store.js";
import type { StatusReadModel, DailyReportReadModel, QuietReadModel, SessionDetailReadModel, CredentialReadModel, ExplainReadModel, ExplainSubjectKind, AuditSummaryReadModel, DreamRecentReadModel, CycleRecentReadModel } from "./types.js";
export type { AuditSummaryReadModel } from "./types.js";
export type { ExplainSubjectKind } from "./types.js";
import type { OperatorFallbackView } from "../../storage/fallback/operator-fallback-view.js";
import { type RhythmPolicySnapshot } from "../../storage/rhythm/rhythm-policy-snapshot.js";
export type { RhythmPolicySnapshot };
export interface CliReadModels {
    loadStatus(scope?: string): Promise<StatusReadModel>;
    loadDailyReport(day: string): Promise<DailyReportReadModel>;
    loadQuiet(scope?: string): Promise<QuietReadModel>;
    loadSession(sessionId: string): Promise<SessionDetailReadModel>;
    loadCredential(platformId: string): Promise<CredentialReadModel>;
    explain(subject: ExplainSubject): Promise<ExplainReadModel>;
    /** T1.2.2 — persisted operator fallback; view status is always not_sent. */
    loadFallbackView(ref: string): Promise<OperatorFallbackView | null>;
    /** T1.2.6 — rhythm policy snapshot for operator `policy show`. */
    loadPolicy(): Promise<RhythmPolicySnapshot>;
    /**
     * T1.2.7 (SN-CODE-02) — minimal audit read-side view for operator `audit` command.
     * Returns a summary of all in-memory audit events in the default store.
     * Empty store returns `{ totalEvents: 0, events: [] }` (honest empty, not an error).
     */
    loadAuditSummary(): Promise<AuditSummaryReadModel>;
    /** T1.2.2 — recent Dream runs from audit store. */
    loadDreamRecent(limit?: number): Promise<DreamRecentReadModel>;
    /** T1.2.5 — recent cycle summary from audit store. */
    loadCycleRecent(limit?: number): Promise<CycleRecentReadModel>;
}
/** T1.2.1 / T1.2.2 — operator-facing read surface (subset of full CLI read models). */
export type OpsReadModelPort = Pick<CliReadModels, "loadStatus" | "loadDailyReport" | "loadQuiet" | "loadSession" | "loadCredential" | "explain" | "loadFallbackView">;
export interface ExplainSubject {
    kind: ExplainSubjectKind;
    id: string;
}
export interface CliReadModelsDeps {
    stateDb: StateDatabase;
    observabilityDb: ObservabilityDatabase;
    /** When set, explain can resolve delivery/fallback/report/source_ref and enrich decision subjects from lived-experience audit envelopes (T5.3.1 / T1.2.1). */
    livedExperienceAuditStore?: AppendOnlyAuditStore;
    /**
     * T1.2.4: when set, `loadQuiet` and `loadDailyReport` also scan `.second-nature/quiet/{day}/`
     * for persisted Quiet artifact JSON files (from `persistQuietArtifactToWorkspace`) and merge
     * them into the read model so operators see non-zero counts after Quiet actually runs.
     */
    workspaceRoot?: string;
}
export declare function createCliReadModels(deps: CliReadModelsDeps): CliReadModels;
