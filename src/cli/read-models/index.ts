import fs from "node:fs";
import path from "node:path";
import { desc } from "drizzle-orm";
import type { StateDatabase } from "../../storage/db/index.js";
import type { ObservabilityDatabase } from "../../observability/db/index.js";
import { createQuietInputLoader } from "../../storage/services/quiet-input-loader.js";
import { AssetRepository } from "../../storage/repositories/asset-repository.js";
import { CredentialRepository } from "../../storage/repositories/credential-repository.js";
import { EvidenceQueryEngine } from "../../observability/query/evidence-query-engine.js";
import {
  decisionLedger,
  executionAttempts,
} from "../../observability/db/schema/index.js";

import { AppendOnlyAuditStore } from "../../observability/audit/append-only-audit-store.js";
import {
  queryExplain,
  type ExplainQuery,
} from "../../observability/query/explain-query.js";

import type {
  StatusReadModel,
  DailyReportReadModel,
  QuietReadModel,
  SessionDetailReadModel,
  CredentialReadModel,
  ExplainReadModel,
  ExplainSubjectKind,
} from "./types.js";

export type { ExplainSubjectKind } from "./types.js";
import { mapOperatorExplainToReadModel } from "./operator-explain-map.js";
import {
  loadOperatorFallbackRow,
  toOperatorFallbackView,
} from "../../storage/fallback/load-operator-fallback.js";
import type { OperatorFallbackView } from "../../storage/fallback/operator-fallback-view.js";

const INTERNAL_RUNTIME_PLATFORM_ID = "second-nature-runtime";
const INTERNAL_RUNTIME_TRACE_PREFIX = "sn-runtime-";

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
export type OpsReadModelPort = Pick<
  CliReadModels,
  | "loadStatus"
  | "loadDailyReport"
  | "loadQuiet"
  | "loadSession"
  | "loadCredential"
  | "explain"
  | "loadFallbackView"
>;

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

function toExplainQuery(subject: ExplainSubject): ExplainQuery | undefined {
  switch (subject.kind) {
    case "decision":
      return { kind: "decision", decisionId: subject.id };
    case "fallback": {
      const ref = subject.id.startsWith("fallback:")
        ? subject.id
        : `fallback:${subject.id}`;
      return { kind: "fallback", fallbackRef: ref };
    }
    case "probe":
    case "report":
      return { kind: "report", reportId: subject.id };
    case "delivery":
      return { kind: "delivery", auditId: subject.id };
    case "source_ref":
      return { kind: "source_ref", sourceRefId: subject.id };
    default:
      return undefined;
  }
}

function isAuditOnlySubjectKind(kind: ExplainSubjectKind): boolean {
  return (
    kind === "fallback" ||
    kind === "probe" ||
    kind === "report" ||
    kind === "delivery" ||
    kind === "source_ref"
  );
}

function buildCredentialNextStep(
  status: CredentialReadModel["status"],
): string | undefined {
  if (status === "pending_verification") return "submit_verification_answer";
  if (status === "expired" || status === "revoked" || status === "failed")
    return "refresh_credential_context";
  return undefined;
}

/**
 * T1.2.4: count persisted Quiet artifact JSON files under `.second-nature/quiet/{day}/`
 * so `loadQuiet` / `loadDailyReport` can reflect Quiet artifacts in the read model.
 */
function countQuietArtifactsForDay(workspaceRoot: string, day: string): number {
  try {
    const dir = path.join(workspaceRoot, ".second-nature", "quiet", day);
    if (!fs.existsSync(dir)) return 0;
    return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).length;
  } catch {
    return 0;
  }
}

/**
 * T1.2.4: scan the last N days under `.second-nature/quiet/` and count total JSON artifacts.
 * Returns { totalArtifacts, recentDays } for merging into QuietReadModel.
 */
function countRecentQuietArtifacts(
  workspaceRoot: string,
  windowDays: number = 2,
): { totalArtifacts: number; recentDays: string[] } {
  try {
    const quietRoot = path.join(workspaceRoot, ".second-nature", "quiet");
    if (!fs.existsSync(quietRoot)) return { totalArtifacts: 0, recentDays: [] };
    const now = Date.now();
    const recentDays: string[] = [];
    let total = 0;
    for (let i = 0; i < windowDays; i++) {
      const d = new Date(now - i * 86400000).toISOString().slice(0, 10);
      const count = countQuietArtifactsForDay(workspaceRoot, d);
      if (count > 0) {
        recentDays.push(d);
        total += count;
      }
    }
    return { totalArtifacts: total, recentDays };
  } catch {
    return { totalArtifacts: 0, recentDays: [] };
  }
}

function mapRuntimeStatus(
  attempt?: { status: string; failureClass: string | null } | undefined,
): StatusReadModel["runtime"]["serviceStatus"] {
  if (!attempt) {
    return "unknown";
  }
  if (attempt.failureClass || attempt.status === "failed") {
    return "degraded";
  }
  return "running";
}

function mapConnectorStatus(
  attempt?: { status: string; failureClass: string | null } | undefined,
): StatusReadModel["connectors"][number]["status"] {
  if (!attempt) {
    return "unknown";
  }
  if (attempt.failureClass || attempt.status === "failed") {
    return "degraded";
  }
  return "healthy";
}

export function createCliReadModels(deps: CliReadModelsDeps): CliReadModels {
  const assetRepository = new AssetRepository(deps.stateDb);
  const credentialRepository = new CredentialRepository(deps.stateDb);
  const quietLoader = createQuietInputLoader(assetRepository);
  const evidenceQuery = new EvidenceQueryEngine(deps.observabilityDb);
  // T1.2.5 (CH-14-05): default-inject an empty AppendOnlyAuditStore so `explain` does not
  // immediately return `lived_experience_audit_store_unavailable` for callers that don't supply
  // an explicit store. The empty store means audit-only subjects return `no_matching_audit_events`
  // instead of a configuration error — which is more accurate and less alarming to operators.
  const auditStore =
    deps.livedExperienceAuditStore ?? new AppendOnlyAuditStore();

  return {
    async loadStatus(_scope?: string): Promise<StatusReadModel> {
      let recentAttempts: Array<typeof executionAttempts.$inferSelect> = [];
      let recentDecisions: Array<typeof decisionLedger.$inferSelect> = [];
      let credentials: Awaited<
        ReturnType<typeof deps.stateDb.db.query.credentialRecords.findMany>
      > = [];

      try {
        recentAttempts = await deps.observabilityDb.db
          .select()
          .from(executionAttempts)
          .orderBy(
            desc(executionAttempts.startedAt),
            desc(executionAttempts.finishedAt),
          )
          .limit(50);
      } catch {
        recentAttempts = [];
      }

      try {
        recentDecisions = await deps.observabilityDb.db
          .select()
          .from(decisionLedger)
          .orderBy(desc(decisionLedger.createdAt))
          .limit(50);
      } catch {
        recentDecisions = [];
      }

      try {
        credentials = await deps.stateDb.db.query.credentialRecords.findMany();
      } catch {
        credentials = [];
      }

      const latestRuntimeAttempt = recentAttempts.find(
        (attempt) => attempt.platformId === INTERNAL_RUNTIME_PLATFORM_ID,
      );
      const latestConnectorAttempt = recentAttempts.find(
        (attempt) => attempt.platformId !== INTERNAL_RUNTIME_PLATFORM_ID,
      );
      const latestRuntimeDecision = recentDecisions.find((decision) =>
        decision.traceId.startsWith(INTERNAL_RUNTIME_TRACE_PREFIX),
      );
      const runtimeUpdatedAt =
        latestRuntimeAttempt?.finishedAt ??
        latestRuntimeAttempt?.startedAt ??
        latestRuntimeDecision?.createdAt ??
        "";
      const quietMode =
        latestRuntimeDecision?.mode === "quiet" ||
        latestRuntimeDecision?.mode === "maintenance_only" ||
        latestRuntimeDecision?.mode === "paused_for_interrupt"
          ? latestRuntimeDecision.mode
          : "unknown";
      const riskFlags = [
        latestRuntimeAttempt?.failureClass,
        latestConnectorAttempt?.failureClass,
      ].filter((value): value is string => Boolean(value));

      const connectorSummary: StatusReadModel["connectors"] =
        latestConnectorAttempt
          ? [
              {
                platformId: latestConnectorAttempt.platformId,
                status: mapConnectorStatus(latestConnectorAttempt),
                channel: latestConnectorAttempt.channel,
                failureClass: latestConnectorAttempt.failureClass ?? undefined,
              },
            ]
          : [];

      return {
        runtime: {
          host: "openclaw-plugin",
          serviceStatus: mapRuntimeStatus(latestRuntimeAttempt),
          updatedAt: runtimeUpdatedAt,
        },
        rhythm: {
          mode:
            (latestRuntimeDecision?.mode as
              | StatusReadModel["rhythm"]["mode"]
              | undefined) ?? "unknown",
          windowId: undefined,
        },
        quiet: {
          mode: quietMode,
          lastEvent: latestRuntimeDecision?.traceId,
          interrupted:
            latestRuntimeDecision?.mode === "paused_for_interrupt"
              ? true
              : undefined,
        },
        connectors: connectorSummary,
        credentials: credentials.map((item) => ({
          platformId:
            (item as unknown as { platformId: string }).platformId ??
            (item as unknown as { platform_id: string }).platform_id,
          status: item.status as CredentialReadModel["status"],
          nextStep: buildCredentialNextStep(
            item.status as CredentialReadModel["status"],
          ),
        })),
        risk: {
          level: riskFlags.length > 0 ? "medium" : "low",
          flags: riskFlags,
        },
        // T1.2.5 (CH-14-04): default delivery posture is workspace_default_none because the
        // workspace heartbeat hardcodes `deliveryCapability: { target: "none" }` until a host
        // capability probe explicitly sets a valid target.
        deliveryPosture: {
          verdict: "none",
          source: "workspace_default_none",
          reasonCode: "delivery_target_none",
        },
      };
    },

    async loadDailyReport(day: string): Promise<DailyReportReadModel> {
      let bundle;
      try {
        bundle = await quietLoader.loadQuietInputs({
          dateRange: {
            start: `${day}T00:00:00.000Z`,
            end: `${day}T23:59:59.999Z`,
          },
          assetFilters: {
            includeJournal: false,
            includeReports: true,
            includeCurated: false,
          },
        });
      } catch {
        bundle = { dailyReports: [], journalEntries: [], sourceCount: 0 };
      }

      // T1.2.4: merge persisted Quiet artifact JSON files from `.second-nature/quiet/{day}/`
      // into the daily report sourceRefs so the read model reflects artifacts written by
      // `persistQuietArtifactToWorkspace` (closes the canonical read/write gap for loadDailyReport).
      const fsArtifactCount = deps.workspaceRoot
        ? countQuietArtifactsForDay(deps.workspaceRoot, day)
        : 0;

      const report = bundle.dailyReports[0];
      const existingSources: string[] = report?.sources ?? [];
      // Append synthetic source refs for each FS artifact not already in the list.
      const fsSourceRefs: string[] = Array.from(
        { length: fsArtifactCount },
        (_, i) => `quiet_artifact:${day}:${i}`,
      ).filter((ref) => !existingSources.includes(ref));

      return {
        day,
        summary: report?.summary ?? "",
        highlights: report?.highlights ?? [],
        sourceRefs: [...existingSources, ...fsSourceRefs],
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

      // T1.2.4 (CH-14-07): also count persisted Quiet artifact JSON files under
      // `.second-nature/quiet/` so that once `runSourceBackedQuiet` has written
      // artifacts to disk, the read model is non-zero even if the legacy memory/
      // journal path is empty.
      const quietArtifacts = deps.workspaceRoot
        ? countRecentQuietArtifacts(deps.workspaceRoot, 2)
        : { totalArtifacts: 0, recentDays: [] };

      const totalSourceCount =
        bundle.sourceCount + quietArtifacts.totalArtifacts;
      const totalReportCount =
        bundle.dailyReports.length + quietArtifacts.totalArtifacts;

      return {
        scope,
        mode: totalSourceCount > 0 ? "quiet" : "unknown",
        sourceCount: totalSourceCount,
        reportCount: totalReportCount,
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
        platformId:
          (record as unknown as { platformId: string }).platformId ??
          (record as unknown as { platform_id: string }).platform_id,
        status: record.status as CredentialReadModel["status"],
        verificationDeadline: record.expiresAt ?? undefined,
        attemptsRemaining: record.attemptsRemaining ?? undefined,
        nextStep: buildCredentialNextStep(
          record.status as CredentialReadModel["status"],
        ),
      };
    },

    async loadFallbackView(ref: string): Promise<OperatorFallbackView | null> {
      const row = await loadOperatorFallbackRow(deps.stateDb, ref);
      if (!row) return null;
      return toOperatorFallbackView(row);
    },

    async explain(subject: ExplainSubject): Promise<ExplainReadModel> {
      const q = toExplainQuery(subject);
      // T1.2.5: auditStore is always non-null (default-injected), so the explain path always
      // has a store available. For audit-only subjects with no matching events the summary
      // from queryExplain will be "no_matching_audit_events" — accurate and non-alarming.
      if (auditStore && q) {
        const op = queryExplain(q, auditStore);
        if (isAuditOnlySubjectKind(subject.kind)) {
          return mapOperatorExplainToReadModel(op, subject.kind);
        }
        if (op.relatedEventIds.length > 0) {
          return mapOperatorExplainToReadModel(op, subject.kind);
        }
      }
      if (isAuditOnlySubjectKind(subject.kind)) {
        return {
          subjectType: subject.kind,
          // auditStore is always present (default-injected by T1.2.5), so this branch is
          // only reached when q is undefined (unresolvable subject kind).
          conclusion: "no_matching_audit_events",
          keyFactors: [],
          evidenceRefs: [],
        };
      }

      const query =
        subject.kind === "decision" ||
        subject.kind === "platform-selection" ||
        subject.kind === "outreach"
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
