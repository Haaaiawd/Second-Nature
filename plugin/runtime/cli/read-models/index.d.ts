import type { StateDatabase } from "../../storage/db/index.js";
import type { ObservabilityDatabase } from "../../observability/db/index.js";
import type { StatusReadModel, DailyReportReadModel, QuietReadModel, SessionDetailReadModel, CredentialReadModel, ExplainReadModel } from "./types.js";
export interface CliReadModels {
    loadStatus(scope?: string): Promise<StatusReadModel>;
    loadDailyReport(day: string): Promise<DailyReportReadModel>;
    loadQuiet(scope?: string): Promise<QuietReadModel>;
    loadSession(sessionId: string): Promise<SessionDetailReadModel>;
    loadCredential(platformId: string): Promise<CredentialReadModel>;
    explain(subject: ExplainSubject): Promise<ExplainReadModel>;
}
export interface ExplainSubject {
    kind: "decision" | "platform-selection" | "outreach" | "soul-change";
    id: string;
}
export interface CliReadModelsDeps {
    stateDb: StateDatabase;
    observabilityDb: ObservabilityDatabase;
}
export declare function createCliReadModels(deps: CliReadModelsDeps): CliReadModels;
