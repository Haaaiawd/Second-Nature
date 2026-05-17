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
  AuditSummaryReadModel,
  DreamRecentReadModel,
  CycleRecentReadModel,
  NarrativeReadModel,
  StatusV6ReadModel,
} from "./types.js";
export type { AuditSummaryReadModel, StatusV6ReadModel } from "./types.js";

export type { ExplainSubjectKind } from "./types.js";
import { mapOperatorExplainToReadModel } from "./operator-explain-map.js";
import {
  loadOperatorFallbackRow,
  toOperatorFallbackView,
} from "../../storage/fallback/load-operator-fallback.js";
import type { OperatorFallbackView } from "../../storage/fallback/operator-fallback-view.js";
import {
  loadRhythmPolicySnapshot,
  type RhythmPolicySnapshot,
} from "../../storage/rhythm/rhythm-policy-snapshot.js";
import { createNarrativeStateStore } from "../../storage/narrative/narrative-state-store.js";

export type { RhythmPolicySnapshot };

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
  /** T1.2.1 — current NarrativeState; returns nothing_yet when no data exists. */
  loadNarrative(narrativeId?: string): Promise<NarrativeReadModel>;
  /**
   * T1.2.6 — v6 status aggregate: StatusReadModel extended with narrative, dream recent,
   * and cycle recent sections. Each section has a sentinel status (nothing_yet / has_runs /
   * has_cycles) so operators always get a meaningful, non-empty response.
   */
  loadV6Status(scope?: string): Promise<StatusV6ReadModel>;
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
  // T1.2.9 (SN-CODE-04): control-plane denial (no eligible intent) is NOT a runtime fault.
  // Return `awaiting_sources` so operators do not misread a clean denied cycle as a crash/degraded.
  if (attempt.failureClass === "decision_denied") {
    return "awaiting_sources";
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

/**
 * Derive groundingStatus from confidence and status.
 *
 * Rules (in priority order):
 * 1. blocked: status === "awaiting_sources" OR confidence < 0.4
 * 2. pass: confidence >= 0.7 AND status === "active"
 * 3. degraded: all other cases (0.4 <= confidence < 0.7, or status is insufficient_sources)
 */
function deriveGroundingStatus(
  status: "active" | "insufficient_sources" | "awaiting_sources",
  confidence: number,
): "pass" | "degraded" | "blocked" {
  if (status === "awaiting_sources" || confidence < 0.4) {
    return "blocked";
  }
  if (confidence >= 0.7 && status === "active") {
    return "pass";
  }
  return "degraded";
}

/**
 * Build the base StatusReadModel that is shared by loadStatus and loadV6Status.
 * Centralising this logic eliminates the DRY violation identified in CR-01.
 */
async function buildBaseStatus(deps: CliReadModelsDeps): Promise<StatusReadModel> {
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
    deliveryPosture: {
      verdict: "none",
      source: "workspace_default_none",
      reasonCode: "delivery_target_none",
    },
  };
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
      return buildBaseStatus(deps);
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

    // T1.2.6 (SN-CODE-01): return the current workspace rhythm policy snapshot so that
    // `policy show` is no longer a notImplemented shell. Returns defaults if no policy row exists.
    async loadPolicy(): Promise<RhythmPolicySnapshot> {
      return loadRhythmPolicySnapshot(deps.stateDb);
    },

    // T1.2.7 (SN-CODE-02): minimal audit read-side for operator `audit` command.
    // Lists all in-memory envelopes with safe redacted fields; empty store returns honest empty.
    async loadAuditSummary(): Promise<AuditSummaryReadModel> {
      const events = auditStore.list();
      return {
        totalEvents: events.length,
        events: events.map((e) => ({
          eventId: e.eventId,
          family: e.family,
          plane: e.plane,
          createdAt: e.createdAt,
          sensitivity: e.redaction.sensitivity,
        })),
      };
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

    // T1.2.2 — read recent DreamTrace events from audit store.
    async loadDreamRecent(limit = 5): Promise<DreamRecentReadModel> {
      const events = auditStore.list().filter((e) => e.family === "dream.trace");
      const recent = events
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);

      return {
        runs: recent.map((e) => {
          const p = e.payload as {
            traceId: string;
            runId: string;
            durationMs: number;
            inputCounts: { evidence: number; chronicle: number; memoryEntries: number };
            fallbackReason?: string;
          };
          return {
            traceId: p.traceId,
            runId: p.runId,
            durationMs: p.durationMs ?? 0,
            inputCounts: p.inputCounts ?? { evidence: 0, chronicle: 0, memoryEntries: 0 },
            fallbackReason: p.fallbackReason,
            lifecycleStatus: p.fallbackReason ? "partial" : "completed",
            insightsCount: 0, // would require deeper payload parsing
            createdAt: e.createdAt,
          };
        }),
        totalRuns: events.length,
      };
    },

    // T1.2.5 — aggregate recent heartbeat, narrative, dream, delivery events into cycles.
    async loadCycleRecent(limit = 5): Promise<CycleRecentReadModel> {
      const events = auditStore.list();
      const decisions = events.filter((e) => e.family === "heartbeat.decision");
      const narratives = events.filter((e) => e.family === "narrative.trace");
      const dreams = events.filter((e) => e.family === "dream.trace");
      const deliveries = events.filter((e) => e.family === "delivery");
      const connectors = events.filter((e) => e.family === "connector.attempt");

      // Group by time buckets (hourly)
      const buckets = new Map<string, CycleRecentReadModel["cycles"][0]>();
      for (const e of decisions) {
        const hour = e.createdAt.slice(0, 13);
        const b = buckets.get(hour) ?? { timestamp: `${hour}:00:00Z`, dimensions: [] };
        if (!b.dimensions.includes("decision")) b.dimensions.push("decision");
        const p = e.payload as { outcome?: string };
        if (p.outcome) b.decisionOutcome = p.outcome;
        buckets.set(hour, b);
      }
      for (const e of narratives) {
        const hour = e.createdAt.slice(0, 13);
        const b = buckets.get(hour) ?? { timestamp: `${hour}:00:00Z`, dimensions: [] };
        if (!b.dimensions.includes("narrative")) b.dimensions.push("narrative");
        const p = e.payload as { groundingStatus?: string };
        if (p.groundingStatus) b.narrativeGrounding = p.groundingStatus;
        buckets.set(hour, b);
      }
      for (const e of dreams) {
        const hour = e.createdAt.slice(0, 13);
        const b = buckets.get(hour) ?? { timestamp: `${hour}:00:00Z`, dimensions: [] };
        if (!b.dimensions.includes("dream")) b.dimensions.push("dream");
        const p = e.payload as { fallbackReason?: string };
        if (p.fallbackReason) b.dreamFallback = p.fallbackReason;
        buckets.set(hour, b);
      }
      for (const e of deliveries) {
        const hour = e.createdAt.slice(0, 13);
        const b = buckets.get(hour) ?? { timestamp: `${hour}:00:00Z`, dimensions: [] };
        if (!b.dimensions.includes("delivery")) b.dimensions.push("delivery");
        const p = e.payload as { status?: string };
        if (p.status) b.deliveryStatus = p.status;
        buckets.set(hour, b);
      }
      for (const e of connectors) {
        const hour = e.createdAt.slice(0, 13);
        const b = buckets.get(hour) ?? { timestamp: `${hour}:00:00Z`, dimensions: [] };
        if (!b.dimensions.includes("connector")) b.dimensions.push("connector");
        buckets.set(hour, b);
      }

      const cycles = Array.from(buckets.values())
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, limit);

      return { cycles, totalCycles: buckets.size };
    },

    // T1.2.6 — v6 status aggregate: compose base status + narrative + dream + cycle sections.
    // Each section returns a sentinel status (nothing_yet / has_runs / has_cycles) so operators
    // always get a meaningful non-empty response, never a raw empty object.
    async loadV6Status(scope?: string): Promise<StatusV6ReadModel> {
      // Load NarrativeState asynchronously; audit events are synchronous reads from in-memory store.
      const narrativeStore = createNarrativeStateStore(deps.stateDb);
      let narrativeState;
      try { narrativeState = await narrativeStore.loadNarrativeState(); } catch { narrativeState = null; }

      const allAuditEvents = auditStore.list();
      const dreamSection = allAuditEvents.filter((e) => e.family === "dream.trace");
      const cycleSection = allAuditEvents;

      const baseStatus = await buildBaseStatus(deps);

      // Narrative section
      let narrativeSectionOut: StatusV6ReadModel["narrative"];
      if (!narrativeState) {
        narrativeSectionOut = { status: "nothing_yet", focus: "", groundingStatus: "blocked", nextIntent: "", sourceRefCount: 0 };
      } else {
        const groundingStatus = deriveGroundingStatus(narrativeState.status, narrativeState.confidence);
        narrativeSectionOut = { status: narrativeState.status, focus: narrativeState.focus, groundingStatus, nextIntent: narrativeState.nextIntent, sourceRefCount: narrativeState.sourceRefs.length };
      }

      // Dream section — degraded when all recorded dream runs have a fallbackReason.
      const dreamEvents = dreamSection;
      let dreamSectionOut: StatusV6ReadModel["dream"];
      if (dreamEvents.length === 0) {
        dreamSectionOut = { status: "nothing_yet", totalRuns: 0, recentRunCount: 0 };
      } else {
        const recentDreams = dreamEvents.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
        const lastFallback = recentDreams.map((e) => (e.payload as { fallbackReason?: string }).fallbackReason).find(Boolean);
        const allDegraded = dreamEvents.every(
          (e) => !!(e.payload as { fallbackReason?: string }).fallbackReason,
        );
        dreamSectionOut = {
          status: allDegraded ? "degraded" : "has_runs",
          totalRuns: dreamEvents.length,
          recentRunCount: recentDreams.length,
          lastFallbackReason: lastFallback,
        };
      }

      // Cycle section — degraded when buckets exist but cover fewer than 3 dimensions.
      const allEvents = cycleSection;
      const decisionEvents = allEvents.filter((e) => e.family === "heartbeat.decision");
      const narrativeEvents = allEvents.filter((e) => e.family === "narrative.trace");
      const dreamEventsForCycle = allEvents.filter((e) => e.family === "dream.trace");
      const deliveryEvents = allEvents.filter((e) => e.family === "delivery");
      const connectorEvents = allEvents.filter((e) => e.family === "connector.attempt");
      const hourBuckets = new Set<string>();
      const dimensionSet = new Set<string>();
      for (const e of decisionEvents) { hourBuckets.add(e.createdAt.slice(0, 13)); dimensionSet.add("decision"); }
      for (const e of narrativeEvents) { hourBuckets.add(e.createdAt.slice(0, 13)); dimensionSet.add("narrative"); }
      for (const e of dreamEventsForCycle) { hourBuckets.add(e.createdAt.slice(0, 13)); dimensionSet.add("dream"); }
      for (const e of deliveryEvents) { hourBuckets.add(e.createdAt.slice(0, 13)); dimensionSet.add("delivery"); }
      for (const e of connectorEvents) { hourBuckets.add(e.createdAt.slice(0, 13)); dimensionSet.add("connector"); }
      let cycleSectionOut: StatusV6ReadModel["cycles"];
      if (hourBuckets.size === 0) {
        cycleSectionOut = { status: "nothing_yet", totalCycles: 0, recentCycleCount: 0, dimensions: [] };
      } else if (dimensionSet.size < 3) {
        cycleSectionOut = { status: "degraded", totalCycles: hourBuckets.size, recentCycleCount: Math.min(hourBuckets.size, 5), dimensions: Array.from(dimensionSet) };
      } else {
        cycleSectionOut = { status: "has_cycles", totalCycles: hourBuckets.size, recentCycleCount: Math.min(hourBuckets.size, 5), dimensions: Array.from(dimensionSet) };
      }

      void scope; // scope param reserved for future scoping — not used in v6 aggregate yet

      return { ...baseStatus, narrative: narrativeSectionOut, dream: dreamSectionOut, cycles: cycleSectionOut };
    },

    // T1.2.1 — read current NarrativeState and map to NarrativeReadModel.
    // Returns `nothing_yet` status when no data exists — honest empty, not an error.
    async loadNarrative(narrativeId?: string): Promise<NarrativeReadModel> {
      const narrativeStore = createNarrativeStateStore(deps.stateDb);
      let state;
      try {
        state = await narrativeStore.loadNarrativeState(narrativeId);
      } catch {
        state = null;
      }

      if (!state) {
        return {
          narrativeId: narrativeId ?? "default",
          revision: 0,
          focus: "",
          progress: [],
          nextIntent: "",
          confidence: 0,
          sourceRefs: [],
          unsupportedClaims: [],
          groundingStatus: "blocked",
          status: "nothing_yet",
          updatedAt: "",
        };
      }

      const groundingStatus = deriveGroundingStatus(state.status, state.confidence);

      return {
        narrativeId: state.narrativeId,
        revision: state.revision,
        focus: state.focus,
        progress: state.progress,
        nextIntent: state.nextIntent,
        confidence: state.confidence,
        sourceRefs: state.sourceRefs.map((r) => ({
          sourceId: r.sourceId,
          kind: r.kind,
          url: r.url,
        })),
        unsupportedClaims: state.unsupportedClaims,
        groundingStatus,
        status: state.status,
        updatedAt: state.updatedAt,
      };
    },
  };
}
