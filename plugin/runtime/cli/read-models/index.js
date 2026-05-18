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
import { createNarrativeStateStore } from "../../storage/narrative/narrative-state-store.js";
import { createRelationshipMemoryStore } from "../../storage/relationship/relationship-memory-store.js";
import { probeCredentialHealth } from "../../storage/services/credential-vault.js";
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
        case "relationship":
            return { kind: "relationship", relationshipId: subject.id };
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
    if (status === "decrypt_failed")
        return "verify_or_re_create_credential_then_re_import";
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
/**
 * Derive groundingStatus from confidence and status.
 *
 * Rules (in priority order):
 * 1. blocked: status === "awaiting_sources" OR confidence < 0.4
 * 2. pass: confidence >= 0.7 AND status === "active"
 * 3. degraded: all other cases (0.4 <= confidence < 0.7, or status is insufficient_sources)
 */
function deriveGroundingStatus(status, confidence) {
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
async function buildBaseStatus(deps) {
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
        },
        quiet: {
            mode: quietMode,
            lastEvent: latestRuntimeDecision?.traceId,
            interrupted: latestRuntimeDecision?.mode === "paused_for_interrupt"
                ? true
                : undefined,
        },
        connectors: connectorSummary,
        credentials: credentials.map((item) => {
            const platformId = item.platformId ??
                item.platform_id;
            const encryptedValue = item.encryptedValue ??
                item.encrypted_value;
            const baseUrl = item.baseUrl ??
                item.base_url;
            const health = probeCredentialHealth(platformId, encryptedValue, baseUrl);
            const effectiveStatus = health.state === "decrypt_failed"
                ? "decrypt_failed"
                : item.status;
            return {
                platformId,
                status: effectiveStatus,
                nextStep: health.diagnosticCode === "missing_runtime_secret"
                    ? "set_SECOND_NATURE_ENCRYPTION_KEY_then_re_probe"
                    : health.diagnosticCode === "credential_recovery_required"
                        ? "verify_or_re_create_credential_then_re_import"
                        : buildCredentialNextStep(effectiveStatus),
                keyHealth: health.keyHealth,
            };
        }),
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
            return buildBaseStatus(deps);
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
                // T1.4.1: even when no row exists, probe key health so status can surface
                // missing_runtime_secret rather than a generic "missing".
                const health = probeCredentialHealth(platformId, null, null);
                return {
                    platformId,
                    status: health.state,
                    nextStep: health.diagnosticCode === "missing_runtime_secret"
                        ? "set_SECOND_NATURE_ENCRYPTION_KEY_then_re_probe"
                        : "provide_credential_context",
                    keyHealth: health.keyHealth,
                };
            }
            // T1.4.1: attempt decryption to detect decrypt_failed / wrong_key.
            const encryptedValue = record.encryptedValue ??
                record.encrypted_value;
            const baseUrl = record.baseUrl ??
                record.base_url;
            const health = probeCredentialHealth(platformId, encryptedValue, baseUrl);
            // If decryption failed, surface the honest diagnostic; otherwise surface DB status.
            const effectiveStatus = health.state === "decrypt_failed"
                ? "decrypt_failed"
                : record.status;
            return {
                platformId: record.platformId ??
                    record.platform_id,
                status: effectiveStatus,
                verificationDeadline: record.expiresAt ?? undefined,
                attemptsRemaining: record.attemptsRemaining ?? undefined,
                nextStep: health.diagnosticCode === "missing_runtime_secret"
                    ? "set_SECOND_NATURE_ENCRYPTION_KEY_then_re_probe"
                    : health.diagnosticCode === "credential_recovery_required"
                        ? "verify_or_re_create_credential_then_re_import"
                        : buildCredentialNextStep(effectiveStatus),
                keyHealth: health.keyHealth,
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
            // T1.4.2: relationship explain reads RelationshipMemory store directly.
            if (subject.kind === "relationship") {
                const relationshipStore = createRelationshipMemoryStore(deps.stateDb);
                const memory = await relationshipStore.loadRelationshipMemory(subject.id);
                if (!memory) {
                    return {
                        subjectType: "relationship",
                        conclusion: "nothing_yet",
                        keyFactors: ["no_relationship_memory_recorded"],
                        evidenceRefs: [],
                        nextStep: "interact_with_agent_then_re_check",
                    };
                }
                return {
                    subjectType: "relationship",
                    conclusion: `tone:${memory.tonePreference} replies:${memory.noReplyCount === 0 ? "responsive" : "cooldown"}`,
                    keyFactors: [
                        `tone_preference:${memory.tonePreference}`,
                        ...(memory.averageReplyDelayMinutes
                            ? [`avg_reply_delay_minutes:${memory.averageReplyDelayMinutes}`]
                            : []),
                        ...(memory.topicAffinities.length > 0
                            ? [`topics:${memory.topicAffinities.map((t) => t.topic).join(",")}`]
                            : ["insufficient_history"]),
                    ],
                    evidenceRefs: memory.sourceRefs.map((s) => s.sourceId),
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
        // T1.2.2 — read recent DreamTrace events from audit store.
        async loadDreamRecent(limit = 5) {
            const events = auditStore.list().filter((e) => e.family === "dream.trace");
            const recent = events
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .slice(0, limit);
            return {
                runs: recent.map((e) => {
                    const p = e.payload;
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
        async loadCycleRecent(limit = 5) {
            const events = auditStore.list();
            const decisions = events.filter((e) => e.family === "heartbeat.decision");
            const narratives = events.filter((e) => e.family === "narrative.trace");
            const dreams = events.filter((e) => e.family === "dream.trace");
            const deliveries = events.filter((e) => e.family === "delivery");
            const connectors = events.filter((e) => e.family === "connector.attempt");
            // Group by time buckets (hourly)
            const buckets = new Map();
            for (const e of decisions) {
                const hour = e.createdAt.slice(0, 13);
                const b = buckets.get(hour) ?? { timestamp: `${hour}:00:00Z`, dimensions: [] };
                if (!b.dimensions.includes("decision"))
                    b.dimensions.push("decision");
                const p = e.payload;
                if (p.outcome)
                    b.decisionOutcome = p.outcome;
                buckets.set(hour, b);
            }
            for (const e of narratives) {
                const hour = e.createdAt.slice(0, 13);
                const b = buckets.get(hour) ?? { timestamp: `${hour}:00:00Z`, dimensions: [] };
                if (!b.dimensions.includes("narrative"))
                    b.dimensions.push("narrative");
                const p = e.payload;
                if (p.groundingStatus)
                    b.narrativeGrounding = p.groundingStatus;
                buckets.set(hour, b);
            }
            for (const e of dreams) {
                const hour = e.createdAt.slice(0, 13);
                const b = buckets.get(hour) ?? { timestamp: `${hour}:00:00Z`, dimensions: [] };
                if (!b.dimensions.includes("dream"))
                    b.dimensions.push("dream");
                const p = e.payload;
                if (p.fallbackReason)
                    b.dreamFallback = p.fallbackReason;
                buckets.set(hour, b);
            }
            for (const e of deliveries) {
                const hour = e.createdAt.slice(0, 13);
                const b = buckets.get(hour) ?? { timestamp: `${hour}:00:00Z`, dimensions: [] };
                if (!b.dimensions.includes("delivery"))
                    b.dimensions.push("delivery");
                const p = e.payload;
                if (p.status)
                    b.deliveryStatus = p.status;
                buckets.set(hour, b);
            }
            for (const e of connectors) {
                const hour = e.createdAt.slice(0, 13);
                const b = buckets.get(hour) ?? { timestamp: `${hour}:00:00Z`, dimensions: [] };
                if (!b.dimensions.includes("connector"))
                    b.dimensions.push("connector");
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
        async loadV6Status(scope) {
            // Load NarrativeState asynchronously; audit events are synchronous reads from in-memory store.
            const narrativeStore = createNarrativeStateStore(deps.stateDb);
            let narrativeState;
            try {
                narrativeState = await narrativeStore.loadNarrativeState();
            }
            catch {
                narrativeState = null;
            }
            const allAuditEvents = auditStore.list();
            const dreamSection = allAuditEvents.filter((e) => e.family === "dream.trace");
            const cycleSection = allAuditEvents;
            const baseStatus = await buildBaseStatus(deps);
            // Narrative section
            let narrativeSectionOut;
            if (!narrativeState) {
                narrativeSectionOut = { status: "nothing_yet", focus: "", groundingStatus: "blocked", nextIntent: "", sourceRefCount: 0 };
            }
            else {
                const groundingStatus = deriveGroundingStatus(narrativeState.status, narrativeState.confidence);
                narrativeSectionOut = { status: narrativeState.status, focus: narrativeState.focus, groundingStatus, nextIntent: narrativeState.nextIntent, sourceRefCount: narrativeState.sourceRefs.length };
            }
            // Dream section — degraded when all recorded dream runs have a fallbackReason.
            const dreamEvents = dreamSection;
            let dreamSectionOut;
            if (dreamEvents.length === 0) {
                dreamSectionOut = { status: "nothing_yet", totalRuns: 0, recentRunCount: 0 };
            }
            else {
                const recentDreams = dreamEvents.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
                const lastFallback = recentDreams.map((e) => e.payload.fallbackReason).find(Boolean);
                const allDegraded = dreamEvents.every((e) => !!e.payload.fallbackReason);
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
            const hourBuckets = new Set();
            const dimensionSet = new Set();
            for (const e of decisionEvents) {
                hourBuckets.add(e.createdAt.slice(0, 13));
                dimensionSet.add("decision");
            }
            for (const e of narrativeEvents) {
                hourBuckets.add(e.createdAt.slice(0, 13));
                dimensionSet.add("narrative");
            }
            for (const e of dreamEventsForCycle) {
                hourBuckets.add(e.createdAt.slice(0, 13));
                dimensionSet.add("dream");
            }
            for (const e of deliveryEvents) {
                hourBuckets.add(e.createdAt.slice(0, 13));
                dimensionSet.add("delivery");
            }
            for (const e of connectorEvents) {
                hourBuckets.add(e.createdAt.slice(0, 13));
                dimensionSet.add("connector");
            }
            let cycleSectionOut;
            if (hourBuckets.size === 0) {
                cycleSectionOut = { status: "nothing_yet", totalCycles: 0, recentCycleCount: 0, dimensions: [] };
            }
            else if (dimensionSet.size < 3) {
                cycleSectionOut = { status: "degraded", totalCycles: hourBuckets.size, recentCycleCount: Math.min(hourBuckets.size, 5), dimensions: Array.from(dimensionSet) };
            }
            else {
                cycleSectionOut = { status: "has_cycles", totalCycles: hourBuckets.size, recentCycleCount: Math.min(hourBuckets.size, 5), dimensions: Array.from(dimensionSet) };
            }
            void scope; // scope param reserved for future scoping — not used in v6 aggregate yet
            return { ...baseStatus, narrative: narrativeSectionOut, dream: dreamSectionOut, cycles: cycleSectionOut };
        },
        // T1.2.1 — read current NarrativeState and map to NarrativeReadModel.
        // Returns `nothing_yet` status when no data exists — honest empty, not an error.
        async loadNarrative(narrativeId) {
            const narrativeStore = createNarrativeStateStore(deps.stateDb);
            let state;
            try {
                state = await narrativeStore.loadNarrativeState(narrativeId);
            }
            catch {
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
