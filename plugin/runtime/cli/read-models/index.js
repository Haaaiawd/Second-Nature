import fs from "node:fs";
import path from "node:path";
import { desc } from "drizzle-orm";
import { createQuietInputLoader } from "../../storage/services/quiet-input-loader.js";
import { AssetRepository } from "../../storage/repositories/asset-repository.js";
import { CredentialRepository } from "../../storage/repositories/credential-repository.js";
import { EvidenceQueryEngine } from "../../observability/query/evidence-query-engine.js";
import { decisionLedger, executionAttempts, } from "../../observability/db/schema/index.js";
import { AppendOnlyAuditStore } from "../../observability/audit/append-only-audit-store.js";
import { queryExplain, } from "../../observability/query/explain-query.js";
import { mapOperatorExplainToReadModel } from "./operator-explain-map.js";
import { loadOperatorFallbackRow, toOperatorFallbackView, } from "../../storage/fallback/load-operator-fallback.js";
import { loadRhythmPolicySnapshot, } from "../../storage/rhythm/rhythm-policy-snapshot.js";
const INTERNAL_RUNTIME_PLATFORM_ID = "second-nature-runtime";
const INTERNAL_RUNTIME_TRACE_PREFIX = "sn-runtime-";
function toExplainQuery(subject) {
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
function isAuditOnlySubjectKind(kind) {
    return (kind === "fallback" ||
        kind === "probe" ||
        kind === "report" ||
        kind === "delivery" ||
        kind === "source_ref");
}
function buildCredentialNextStep(status) {
    if (status === "pending_verification")
        return "submit_verification_answer";
    if (status === "expired" || status === "revoked" || status === "failed")
        return "refresh_credential_context";
    return undefined;
}
/**
 * T1.2.4: count persisted Quiet artifact JSON files under `.second-nature/quiet/{day}/`
 * so `loadQuiet` / `loadDailyReport` can reflect Quiet artifacts in the read model.
 */
function countQuietArtifactsForDay(workspaceRoot, day) {
    try {
        const dir = path.join(workspaceRoot, ".second-nature", "quiet", day);
        if (!fs.existsSync(dir))
            return 0;
        return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).length;
    }
    catch {
        return 0;
    }
}
/**
 * T1.2.4: scan the last N days under `.second-nature/quiet/` and count total JSON artifacts.
 * Returns { totalArtifacts, recentDays } for merging into QuietReadModel.
 */
function countRecentQuietArtifacts(workspaceRoot, windowDays = 2) {
    try {
        const quietRoot = path.join(workspaceRoot, ".second-nature", "quiet");
        if (!fs.existsSync(quietRoot))
            return { totalArtifacts: 0, recentDays: [] };
        const now = Date.now();
        const recentDays = [];
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
    }
    catch {
        return { totalArtifacts: 0, recentDays: [] };
    }
}
function mapRuntimeStatus(attempt) {
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
function mapConnectorStatus(attempt) {
    if (!attempt) {
        return "unknown";
    }
    if (attempt.failureClass || attempt.status === "failed") {
        return "degraded";
    }
    return "healthy";
}
export function createCliReadModels(deps) {
    const assetRepository = new AssetRepository(deps.stateDb);
    const credentialRepository = new CredentialRepository(deps.stateDb);
    const quietLoader = createQuietInputLoader(assetRepository);
    const evidenceQuery = new EvidenceQueryEngine(deps.observabilityDb);
    // T1.2.5 (CH-14-05): default-inject an empty AppendOnlyAuditStore so `explain` does not
    // immediately return `lived_experience_audit_store_unavailable` for callers that don't supply
    // an explicit store. The empty store means audit-only subjects return `no_matching_audit_events`
    // instead of a configuration error — which is more accurate and less alarming to operators.
    const auditStore = deps.livedExperienceAuditStore ?? new AppendOnlyAuditStore();
    return {
        async loadStatus(_scope) {
            let recentAttempts = [];
            let recentDecisions = [];
            let credentials = [];
            try {
                recentAttempts = await deps.observabilityDb.db
                    .select()
                    .from(executionAttempts)
                    .orderBy(desc(executionAttempts.startedAt), desc(executionAttempts.finishedAt))
                    .limit(50);
            }
            catch {
                recentAttempts = [];
            }
            try {
                recentDecisions = await deps.observabilityDb.db
                    .select()
                    .from(decisionLedger)
                    .orderBy(desc(decisionLedger.createdAt))
                    .limit(50);
            }
            catch {
                recentDecisions = [];
            }
            try {
                credentials = await deps.stateDb.db.query.credentialRecords.findMany();
            }
            catch {
                credentials = [];
            }
            const latestRuntimeAttempt = recentAttempts.find((attempt) => attempt.platformId === INTERNAL_RUNTIME_PLATFORM_ID);
            // CH-15-04 (CH-14-03): latestConnectorAttempt is the most recent execution attempt whose
            // platformId is NOT the internal sn-runtime sentinel — i.e. a real connector platform
            // (Moltbook, EvoMap, etc.). The `connectors` array in StatusReadModel reflects this single
            // most-recent non-runtime attempt, NOT the full connector manifest. An empty array means
            // no connector attempt has been recorded yet, not that connectors are misconfigured.
            const latestConnectorAttempt = recentAttempts.find((attempt) => attempt.platformId !== INTERNAL_RUNTIME_PLATFORM_ID);
            const latestRuntimeDecision = recentDecisions.find((decision) => decision.traceId.startsWith(INTERNAL_RUNTIME_TRACE_PREFIX));
            const runtimeUpdatedAt = latestRuntimeAttempt?.finishedAt ??
                latestRuntimeAttempt?.startedAt ??
                latestRuntimeDecision?.createdAt ??
                "";
            const quietMode = latestRuntimeDecision?.mode === "quiet" ||
                latestRuntimeDecision?.mode === "maintenance_only" ||
                latestRuntimeDecision?.mode === "paused_for_interrupt"
                ? latestRuntimeDecision.mode
                : "unknown";
            const riskFlags = [
                latestRuntimeAttempt?.failureClass,
                latestConnectorAttempt?.failureClass,
            ].filter((value) => Boolean(value));
            const connectorSummary = latestConnectorAttempt
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
                    mode: latestRuntimeDecision?.mode ?? "unknown",
                    windowId: undefined,
                },
                quiet: {
                    mode: quietMode,
                    lastEvent: latestRuntimeDecision?.traceId,
                    interrupted: latestRuntimeDecision?.mode === "paused_for_interrupt"
                        ? true
                        : undefined,
                },
                connectors: connectorSummary,
                credentials: credentials.map((item) => ({
                    platformId: item.platformId ??
                        item.platform_id,
                    status: item.status,
                    nextStep: buildCredentialNextStep(item.status),
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
        async loadDailyReport(day) {
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
            }
            catch {
                bundle = { dailyReports: [], journalEntries: [], sourceCount: 0 };
            }
            // T1.2.4: merge persisted Quiet artifact JSON files from `.second-nature/quiet/{day}/`
            // into the daily report sourceRefs so the read model reflects artifacts written by
            // `persistQuietArtifactToWorkspace` (closes the canonical read/write gap for loadDailyReport).
            const fsArtifactCount = deps.workspaceRoot
                ? countQuietArtifactsForDay(deps.workspaceRoot, day)
                : 0;
            const report = bundle.dailyReports[0];
            const existingSources = report?.sources ?? [];
            // Append synthetic source refs for each FS artifact not already in the list.
            const fsSourceRefs = Array.from({ length: fsArtifactCount }, (_, i) => `quiet_artifact:${day}:${i}`).filter((ref) => !existingSources.includes(ref));
            return {
                day,
                summary: report?.summary ?? "",
                highlights: report?.highlights ?? [],
                sourceRefs: [...existingSources, ...fsSourceRefs],
            };
        },
        async loadQuiet(scope) {
            const now = new Date();
            const start = new Date(now);
            start.setDate(now.getDate() - 1);
            let bundle;
            try {
                bundle = await quietLoader.loadQuietInputs({
                    dateRange: { start: start.toISOString(), end: now.toISOString() },
                });
            }
            catch {
                bundle = { dailyReports: [], journalEntries: [], sourceCount: 0 };
            }
            // T1.2.4 (CH-14-07): also count persisted Quiet artifact JSON files under
            // `.second-nature/quiet/` so that once `runSourceBackedQuiet` has written
            // artifacts to disk, the read model is non-zero even if the legacy memory/
            // journal path is empty.
            const quietArtifacts = deps.workspaceRoot
                ? countRecentQuietArtifacts(deps.workspaceRoot, 2)
                : { totalArtifacts: 0, recentDays: [] };
            const totalSourceCount = bundle.sourceCount + quietArtifacts.totalArtifacts;
            const totalReportCount = bundle.dailyReports.length + quietArtifacts.totalArtifacts;
            return {
                scope,
                mode: totalSourceCount > 0 ? "quiet" : "unknown",
                sourceCount: totalSourceCount,
                reportCount: totalReportCount,
                recentJournalCount: bundle.journalEntries.length,
            };
        },
        async loadSession(sessionId) {
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
        async loadCredential(platformId) {
            let record;
            try {
                record = await credentialRepository.findByPlatformId(platformId);
            }
            catch {
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
                platformId: record.platformId ??
                    record.platform_id,
                status: record.status,
                verificationDeadline: record.expiresAt ?? undefined,
                attemptsRemaining: record.attemptsRemaining ?? undefined,
                nextStep: buildCredentialNextStep(record.status),
            };
        },
        async loadFallbackView(ref) {
            const row = await loadOperatorFallbackRow(deps.stateDb, ref);
            if (!row)
                return null;
            return toOperatorFallbackView(row);
        },
        // T1.2.6 (SN-CODE-01): return the current workspace rhythm policy snapshot so that
        // `policy show` is no longer a notImplemented shell. Returns defaults if no policy row exists.
        async loadPolicy() {
            return loadRhythmPolicySnapshot(deps.stateDb);
        },
        // T1.2.7 (SN-CODE-02): minimal audit read-side for operator `audit` command.
        // Lists all in-memory envelopes with safe redacted fields; empty store returns honest empty.
        async loadAuditSummary() {
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
        async explain(subject) {
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
            const query = subject.kind === "decision" ||
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
