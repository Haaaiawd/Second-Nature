import type { StateDatabase } from "../../storage/db/index.js";
import type { ObservabilityDatabase } from "../../observability/db/index.js";
import { AppendOnlyAuditStore } from "../../observability/audit/append-only-audit-store.js";
import type { StatusReadModel, DailyReportReadModel, QuietReadModel, SessionDetailReadModel, CredentialReadModel, ExplainReadModel, ExplainSubjectKind } from "./types.js";
export type { ExplainSubjectKind } from "./types.js";
import type { OperatorFallbackView } from "../../storage/fallback/operator-fallback-view.js";
export interface CliReadModels {
    loadStatus(scope?: string): Promise<StatusReadModel>;
    loadDailyReport(day: string): Promise<DailyReportReadModel>;
    loadQuiet(scope?: string): Promise<QuietReadModel>;
    loadSession(sessionId: string): Promise<SessionDetailReadModel>;
    loadCredential(platformId: string): Promise<CredentialReadModel>;
    explain(subject: ExplainSubject): Promise<ExplainReadModel>;
    /** T1.2.2 — persisted operator fallback; view status is always not_sent. */
    loadFallbackView(ref: string): Promise<OperatorFallbackView | null>;
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
}
export declare function createCliReadModels(deps: CliReadModelsDeps): CliReadModels;
