import type { StateDatabase } from "../../storage/db/index.js";
import type { ObservabilityDatabase } from "../../observability/db/index.js";
import { createQuietInputLoader } from "../../storage/services/quiet-input-loader.js";
import { AssetRepository } from "../../storage/repositories/asset-repository.js";
import { CredentialRepository } from "../../storage/repositories/credential-repository.js";
import { EvidenceQueryEngine } from "../../observability/query/evidence-query-engine.js";
import { executionAttempts } from "../../observability/db/schema/index.js";
import { desc } from "drizzle-orm";

import type {
  StatusReadModel,
  DailyReportReadModel,
  QuietReadModel,
  SessionDetailReadModel,
  CredentialReadModel,
  ExplainReadModel,
} from "./types.js";

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

function buildCredentialNextStep(status: CredentialReadModel["status"]): string | undefined {
  if (status === "pending_verification") return "submit_verification_answer";
  if (status === "expired" || status === "revoked" || status === "failed") return "refresh_credential_context";
  return undefined;
}

export function createCliReadModels(deps: CliReadModelsDeps): CliReadModels {
  const assetRepository = new AssetRepository(deps.stateDb);
  const credentialRepository = new CredentialRepository(deps.stateDb);
  const quietLoader = createQuietInputLoader(assetRepository);
  const evidenceQuery = new EvidenceQueryEngine(deps.observabilityDb);

  return {
    async loadStatus(_scope?: string): Promise<StatusReadModel> {
      let latestAttempt: Awaited<ReturnType<typeof deps.observabilityDb.db.query.executionAttempts.findFirst>>;
      let credentials: Awaited<ReturnType<typeof deps.stateDb.db.query.credentialRecords.findMany>> = [];

      try {
        latestAttempt = await deps.observabilityDb.db.query.executionAttempts.findFirst({
          orderBy: [desc(executionAttempts.startedAt)],
        });
      } catch {
        latestAttempt = undefined;
      }

      try {
        credentials = await deps.stateDb.db.query.credentialRecords.findMany();
      } catch {
        credentials = [];
      }

      const connectorSummary: StatusReadModel["connectors"] = latestAttempt
        ? [{
            platformId: latestAttempt.platformId,
            status: latestAttempt.failureClass ? "degraded" : "healthy",
            channel: latestAttempt.channel,
            failureClass: latestAttempt.failureClass ?? undefined,
          }]
        : [];

      return {
        runtime: {
          host: "openclaw-plugin",
          serviceStatus: latestAttempt ? (latestAttempt.failureClass ? "degraded" : "running") : "unknown",
          updatedAt: new Date().toISOString(),
        },
        rhythm: {
          mode: "unknown",
          windowId: undefined,
        },
        quiet: {
          mode: "unknown",
          lastEvent: undefined,
          interrupted: undefined,
        },
        connectors: connectorSummary,
        credentials: credentials.map((item) => ({
          platformId: item.platformId,
          status: item.status as CredentialReadModel["status"],
          nextStep: buildCredentialNextStep(item.status as CredentialReadModel["status"]),
        })),
        risk: {
          level: latestAttempt?.failureClass ? "medium" : "low",
          flags: latestAttempt?.failureClass ? [latestAttempt.failureClass] : [],
        },
      };
    },

    async loadDailyReport(day: string): Promise<DailyReportReadModel> {
      let bundle;
      try {
        bundle = await quietLoader.loadQuietInputs({
          dateRange: { start: `${day}T00:00:00.000Z`, end: `${day}T23:59:59.999Z` },
          assetFilters: { includeJournal: false, includeReports: true, includeCurated: false },
        });
      } catch {
        bundle = { dailyReports: [], journalEntries: [], sourceCount: 0 };
      }

      const report = bundle.dailyReports[0];
      return {
        day,
        summary: report?.summary ?? "",
        highlights: report?.highlights ?? [],
        sourceRefs: report?.sources ?? [],
      };
    },

    async loadQuiet(scope?: string): Promise<QuietReadModel> {
      const now = new Date();
      const start = new Date(now);
      start.setDate(now.getDate() - 1);

      let bundle;
      try {
        bundle = await quietLoader.loadQuietInputs({
          dateRange: { start: start.toISOString(), end: now.toISOString() },
        });
      } catch {
        bundle = { dailyReports: [], journalEntries: [], sourceCount: 0 };
      }

      return {
        scope,
        mode: bundle.sourceCount > 0 ? "quiet" : "unknown",
        sourceCount: bundle.sourceCount,
        reportCount: bundle.dailyReports.length,
        recentJournalCount: bundle.journalEntries.length,
      };
    },

    async loadSession(sessionId: string): Promise<SessionDetailReadModel> {
      const traceId = sessionId;
      const bundle = await evidenceQuery.queryEvidence({ traceId });
      return {
        requestedSessionId: sessionId,
        traceId,
        decisionCount: bundle.decisions.length,
        attemptCount: bundle.attempts.length,
        governanceCount: bundle.governance.length,
        keyFactors: bundle.explanation.keyFactors,
        evidenceRefs: bundle.explanation.evidenceRefs,
      };
    },

    async loadCredential(platformId: string): Promise<CredentialReadModel> {
      let record;
      try {
        record = await credentialRepository.findByPlatformId(platformId);
      } catch {
        record = undefined;
      }
      if (!record) {
        return {
          platformId,
          status: "missing",
          nextStep: "provide_credential_context",
        };
      }

      return {
        platformId: record.platformId,
        status: record.status as CredentialReadModel["status"],
        verificationDeadline: record.expiresAt ?? undefined,
        attemptsRemaining: record.attemptsRemaining ?? undefined,
        nextStep: buildCredentialNextStep(record.status as CredentialReadModel["status"]),
      };
    },

    async explain(subject: ExplainSubject): Promise<ExplainReadModel> {
      const query =
        subject.kind === "decision" || subject.kind === "platform-selection" || subject.kind === "outreach"
          ? { decisionId: subject.id }
          : { assetId: subject.id };

      const bundle = await evidenceQuery.queryEvidence(query);
      return {
        subjectType: subject.kind,
        conclusion: bundle.explanation.conclusion,
        keyFactors: bundle.explanation.keyFactors,
        evidenceRefs: bundle.explanation.evidenceRefs,
      };
    },
  };
}
