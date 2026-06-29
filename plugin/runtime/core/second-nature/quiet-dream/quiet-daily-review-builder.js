/**
 * QuietDailyReviewBuilder — Aggregate daily closures, perceptions, and
 * memory-review candidates into a readable, source-backed QuietDailyReview.
 *
 * Core logic: Read ActionClosureRecords by day, collect memory-review
 * candidates and attached PerceptionCard summaries, build a human-readable
 * review, and write QuietDailyReview row.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.detail.md §3.1`
 * - `.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.md §4.2`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (readActionClosuresByDay, readPerceptionCardById, writeQuietDailyReview)
 * - `src/shared/types/v8-contracts.js` (SourceRef, DegradedOperationResult, V8ReasonCode)
 *
 * Boundary:
 * - Does not form long-term memory; only emits review input for Dream.
 * - Does not judge importance; reads closure status and risk flags.
 * - Degrades gracefully on unreadable state.
 *
 * Test coverage: tests/unit/quiet/quiet-daily-review-builder.test.ts
 */
import { readActionClosuresByDay, writeQuietDailyReview, readPerceptionCardById, readEvidenceItemsByDay, readPerceptionCardsByDay, } from "../../../storage/v8-state-stores.js";
import { parseSourceRefs } from "../../../shared/serialization.js";
// ───────────────────────────────────────────────────────────────
// Config
// ───────────────────────────────────────────────────────────────
const QUIET_MAX_CLOSURES_PER_DAY = 200;
const QUIET_REVIEW_MAX_MEMORY_CANDIDATES = 20;
// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────
function todayString(now) {
    return now.slice(0, 10);
}
function parsePayloadJson(json) {
    if (!json)
        return {};
    try {
        return JSON.parse(json);
    }
    catch {
        return {};
    }
}
function buildSourceRefFromClosure(closure) {
    return {
        uri: `sn://closure/${closure.id}`,
        family: "action_closure",
        id: closure.id,
        redactionClass: "none",
        resolveStatus: "resolvable",
    };
}
function buildSourceRefFromEvidence(evidence) {
    const refs = parseSourceRefs(evidence.sourceRefsJson);
    return (refs[0] ?? {
        uri: `sn://evidence/${evidence.id}`,
        family: "evidence",
        id: evidence.id,
        redactionClass: "none",
        resolveStatus: "resolvable",
    });
}
function buildSourceRefFromPerception(perception) {
    const refs = parseSourceRefs(perception.sourceRefsJson);
    return (refs[0] ?? {
        uri: `sn://perception/${perception.id}`,
        family: "perception",
        id: perception.id,
        redactionClass: "none",
        resolveStatus: "resolvable",
    });
}
function renderActionKind(actionKind) {
    if (!actionKind)
        return "action";
    switch (actionKind) {
        case "notify_owner":
            return "notified you";
        case "draft_reply":
            return "drafted a reply";
        case "remember":
            return "remembered for review";
        case "watch":
            return "watched";
        case "auto_reply":
            return "auto-replied";
        default:
            return actionKind;
    }
}
function renderClosureLine(entry) {
    const platform = entry.platformId ?? "system";
    const action = renderActionKind(entry.actionKind);
    const reason = entry.reason ? ` (${entry.reason})` : "";
    const summary = entry.summary ? `: ${entry.summary}` : "";
    return `- ${platform} ${action}${summary}${reason} [${entry.closureId}]`;
}
function groupByStatus(entries) {
    const groups = {};
    for (const entry of entries) {
        if (!groups[entry.status])
            groups[entry.status] = [];
        groups[entry.status].push(entry);
    }
    return groups;
}
// Placeholder/template detector: true when the review has no content-bearing
// evidence or perception signals and no memory-review candidates. Closure-only
// system text is not meaningful memory input.
function isPlaceholderReview(notableSignals, memoryCandidates, evidenceRows, perceptionRows) {
    if (memoryCandidates.length > 0)
        return false;
    if (notableSignals.length > 0)
        return false;
    const hasContentEvidence = evidenceRows.some((ev) => {
        const payload = parsePayloadJson(ev.payloadJson);
        return payload.contentStatus !== "content_missing";
    });
    if (hasContentEvidence)
        return false;
    const hasContentPerception = perceptionRows.some((p) => !!p.summary);
    if (hasContentPerception)
        return false;
    return true;
}
// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────
export async function buildQuietDailyReview(db, options) {
    const now = options?.now ?? new Date().toISOString();
    const day = options?.day ?? todayString(now);
    const readResult = await readActionClosuresByDay(db, day);
    if (readResult.degraded) {
        return readResult.degraded;
    }
    const closures = readResult.rows.slice(0, QUIET_MAX_CLOSURES_PER_DAY);
    if (closures.length === 0) {
        return {
            status: "empty",
            reason: "quiet_empty_input",
        };
    }
    const closureRefs = closures.map(buildSourceRefFromClosure);
    let sourceRefs = [...closureRefs];
    // Load content-bearing evidence and perception rows for the day
    const evidenceRead = await readEvidenceItemsByDay(db, day);
    if (evidenceRead.degraded) {
        return evidenceRead.degraded;
    }
    const perceptionRead = await readPerceptionCardsByDay(db, day);
    if (perceptionRead.degraded) {
        return perceptionRead.degraded;
    }
    const evidenceRows = evidenceRead.rows.slice(0, 100);
    const perceptionRows = perceptionRead.rows.slice(0, 100);
    sourceRefs.push(...evidenceRows.map(buildSourceRefFromEvidence));
    sourceRefs.push(...perceptionRows.map(buildSourceRefFromPerception));
    sourceRefs = [...new Map(sourceRefs.map((r) => [r.uri, r])).values()];
    // Build readable entries, enriching with perception summary when available
    const entries = [];
    const memoryCandidates = [];
    const notableSignals = [];
    for (const closure of closures) {
        const payload = parsePayloadJson(closure.payloadJson);
        let summary;
        let actionKind;
        const perceptionId = payload.perceptionCardId;
        if (perceptionId) {
            const perceptionRead = await readPerceptionCardById(db, perceptionId);
            if (!perceptionRead.degraded && perceptionRead.row) {
                summary = perceptionRead.row.summary ?? undefined;
                const perceptionPayload = parsePayloadJson(perceptionRead.row.payloadJson);
                if (perceptionPayload.possibleIntents && Array.isArray(perceptionPayload.possibleIntents)) {
                    actionKind = perceptionPayload.possibleIntents[0];
                }
            }
        }
        // Action kind fallback from closure payload
        if (!actionKind && payload.actionKind) {
            actionKind = String(payload.actionKind);
        }
        entries.push({
            closureId: closure.id,
            platformId: closure.platformId ?? undefined,
            actionKind,
            status: closure.status,
            summary,
            reason: closure.reason ? String(closure.reason) : undefined,
        });
        if (payload.memoryReviewCandidate) {
            memoryCandidates.push(payload.memoryReviewCandidate);
        }
    }
    for (const perception of perceptionRows) {
        if (perception.summary) {
            const perceptionPayload = parsePayloadJson(perception.payloadJson);
            if (perceptionPayload.contentMissing) {
                continue;
            }
            notableSignals.push(`Perception: ${perception.summary}`);
        }
    }
    for (const evidence of evidenceRows) {
        const payload = parsePayloadJson(evidence.payloadJson);
        if (payload.contentStatus === "content_missing") {
            continue;
        }
        if (payload.summary) {
            notableSignals.push(`${evidence.platformId}: ${String(payload.summary)}`);
        }
        else if (payload.title) {
            notableSignals.push(`${evidence.platformId}: ${String(payload.title)}`);
        }
    }
    const groups = groupByStatus(entries);
    // Build sections
    const sections = [];
    sections.push({
        kind: "headline",
        title: "Headline",
        lines: [`Today I processed ${closures.length} action closures across ${new Set(entries.map((e) => e.platformId)).size} platforms.`],
    });
    if (groups.completed?.length) {
        sections.push({
            kind: "completed",
            title: "Completed",
            lines: groups.completed.slice(0, 10).map(renderClosureLine),
        });
    }
    if (groups.deferred?.length || groups.denied?.length) {
        const deferred = [...(groups.deferred ?? []), ...(groups.denied ?? [])];
        sections.push({
            kind: "deferred",
            title: "Deferred / Denied",
            lines: deferred.slice(0, 10).map(renderClosureLine),
        });
    }
    if (groups.failed?.length) {
        sections.push({
            kind: "failed",
            title: "Failed / Need Attention",
            lines: groups.failed.slice(0, 10).map(renderClosureLine),
        });
    }
    const displayCandidates = memoryCandidates.slice(0, QUIET_REVIEW_MAX_MEMORY_CANDIDATES);
    if (displayCandidates.length > 0) {
        sections.push({
            kind: "memory_candidates",
            title: "Memory-review candidates",
            lines: displayCandidates.map((c) => `- ${c.topicKey ?? "memory candidate"}${c.memoryIntentReason ? ` (${c.memoryIntentReason})` : ""} [${c.perceptionRef?.id ?? "?"}]`),
        });
    }
    if (notableSignals.length > 0) {
        sections.push({
            kind: "observations",
            title: "Notable signals",
            lines: notableSignals.slice(0, 20).map((s) => `- ${s}`),
        });
    }
    const completedCount = groups.completed?.length ?? 0;
    const deniedCount = (groups.denied?.length ?? 0) + (groups.deferred?.length ?? 0);
    const failedCount = groups.failed?.length ?? 0;
    const firstEvidencePayload = evidenceRows[0] ? parsePayloadJson(evidenceRows[0].payloadJson) : {};
    const firstTopic = perceptionRows[0]?.topic
        ?? (firstEvidencePayload.title ? String(firstEvidencePayload.title) : undefined)
        ?? (firstEvidencePayload.summary ? String(firstEvidencePayload.summary) : undefined)
        ?? evidenceRows[0]?.platformId;
    const reviewSummary = firstTopic
        ? `Day ${day}: ${closures.length} closures around ${firstTopic}${notableSignals.length > 0 ? ` with ${notableSignals.length} notable signals` : ""}.`
        : `Day ${day}: ${closures.length} closures (${completedCount} completed, ${deniedCount} deferred/denied, ${failedCount} failed)`;
    const isPlaceholder = isPlaceholderReview(notableSignals, memoryCandidates, evidenceRows, perceptionRows);
    const contentStatus = isPlaceholder
        ? "placeholder_rejected"
        : (notableSignals.length > 0 || memoryCandidates.length > 0)
            ? "content_present"
            : "content_missing";
    const importanceSignals = [];
    if (memoryCandidates.length > 0) {
        importanceSignals.push(`${memoryCandidates.length} memory-review candidates`);
    }
    if (failedCount > 0) {
        importanceSignals.push(`${failedCount} failed actions`);
    }
    if (notableSignals.length > 0) {
        importanceSignals.push(`${notableSignals.length} notable signals`);
    }
    const reviewId = `quiet_${day}`;
    const writeResult = await writeQuietDailyReview(db, {
        id: reviewId,
        createdAt: now,
        day,
        closureCount: closures.length,
        memoryCandidateCount: memoryCandidates.length,
        sourceRefs,
        closureRefs,
        redactionClass: "none",
        lifecycleStatus: "pending",
        payloadJson: JSON.stringify({
            reviewSummary,
            contentStatus,
            importanceSignals,
            memoryCandidates,
            sections,
        }),
    });
    if ("reason" in writeResult) {
        return writeResult;
    }
    return {
        status: "completed",
        review: {
            id: reviewId,
            day,
            closureCount: closures.length,
            memoryCandidateCount: memoryCandidates.length,
            sourceRefs,
            closureRefs,
            reviewSummary,
            sections,
            importanceSignals,
            createdAt: now,
        },
    };
}
