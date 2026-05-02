import { desc } from "drizzle-orm";
import { createQuietInputLoader } from "../../storage/services/quiet-input-loader.js";
import { AssetRepository } from "../../storage/repositories/asset-repository.js";
import { CredentialRepository } from "../../storage/repositories/credential-repository.js";
import { EvidenceQueryEngine } from "../../observability/query/evidence-query-engine.js";
import { decisionLedger, executionAttempts } from "../../observability/db/schema/index.js";
import { queryExplain } from "../../observability/query/explain-query.js";
import { mapOperatorExplainToReadModel } from "./operator-explain-map.js";
const INTERNAL_RUNTIME_PLATFORM_ID = "second-nature-runtime";
const INTERNAL_RUNTIME_TRACE_PREFIX = "sn-runtime-";
function toExplainQuery(subject) {
    switch (subject.kind) {
        case "decision":
            return { kind: "decision", decisionId: subject.id };
        case "fallback": {
            const ref = subject.id.startsWith("fallback:") ? subject.id : `fallback:${subject.id}`;
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
    return kind === "fallback" || kind === "probe" || kind === "report" || kind === "delivery" || kind === "source_ref";
}
function buildCredentialNextStep(status) {
    if (status === "pending_verification")
        return "submit_verification_answer";
    if (status === "expired" || status === "revoked" || status === "failed")
        return "refresh_credential_context";
    return undefined;
}
function mapRuntimeStatus(attempt) {
    if (!attempt) {
        return "unknown";
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
    const auditStore = deps.livedExperienceAuditStore;
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
            const latestConnectorAttempt = recentAttempts.find((attempt) => attempt.platformId !== INTERNAL_RUNTIME_PLATFORM_ID);
            const latestRuntimeDecision = recentDecisions.find((decision) => decision.traceId.startsWith(INTERNAL_RUNTIME_TRACE_PREFIX));
            const runtimeUpdatedAt = latestRuntimeAttempt?.finishedAt ?? latestRuntimeAttempt?.startedAt ?? latestRuntimeDecision?.createdAt ?? "";
            const quietMode = latestRuntimeDecision?.mode === "quiet" ||
                latestRuntimeDecision?.mode === "maintenance_only" ||
                latestRuntimeDecision?.mode === "paused_for_interrupt"
                ? latestRuntimeDecision.mode
                : "unknown";
            const riskFlags = [latestRuntimeAttempt?.failureClass, latestConnectorAttempt?.failureClass].filter((value) => Boolean(value));
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
                    interrupted: latestRuntimeDecision?.mode === "paused_for_interrupt" ? true : undefined,
                },
                connectors: connectorSummary,
                credentials: credentials.map((item) => ({
                    platformId: item.platformId ?? item.platform_id,
                    status: item.status,
                    nextStep: buildCredentialNextStep(item.status),
                })),
                risk: {
                    level: riskFlags.length > 0 ? "medium" : "low",
                    flags: riskFlags,
                },
            };
        },
        async loadDailyReport(day) {
            let bundle;
            try {
                bundle = await quietLoader.loadQuietInputs({
                    dateRange: { start: `${day}T00:00:00.000Z`, end: `${day}T23:59:59.999Z` },
                    assetFilters: { includeJournal: false, includeReports: true, includeCurated: false },
                });
            }
            catch {
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
            return {
                scope,
                mode: bundle.sourceCount > 0 ? "quiet" : "unknown",
                sourceCount: bundle.sourceCount,
                reportCount: bundle.dailyReports.length,
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
                platformId: record.platformId ?? record.platform_id,
                status: record.status,
                verificationDeadline: record.expiresAt ?? undefined,
                attemptsRemaining: record.attemptsRemaining ?? undefined,
                nextStep: buildCredentialNextStep(record.status),
            };
        },
        async explain(subject) {
            const q = toExplainQuery(subject);
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
                    conclusion: auditStore ? "no_matching_audit_events" : "lived_experience_audit_store_unavailable",
                    keyFactors: auditStore ? [] : ["configure_lived_experience_audit_store_for_operator_explain"],
                    evidenceRefs: [],
                };
            }
            const query = subject.kind === "decision" || subject.kind === "platform-selection" || subject.kind === "outreach"
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
