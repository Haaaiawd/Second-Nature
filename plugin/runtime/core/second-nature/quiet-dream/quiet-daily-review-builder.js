/**
 * QuietDailyReviewBuilder — Aggregate daily closures, perceptions, and
 * memory-review candidates into a source-backed QuietDailyReview.
 *
 * Core logic: Read ActionClosureRecords by day, collect memory-review
 * candidates, build summary, and write QuietDailyReview row.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.detail.md §3.1`
 * - `.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.md §4.2`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (readActionClosuresByDay, writeQuietDailyReview)
 * - `src/shared/types/v8-contracts.js` (SourceRef, DegradedOperationResult, V8ReasonCode)
 *
 * Boundary:
 * - Does not form long-term memory; only emits review input for Dream.
 * - Does not judge importance; reads closure status and risk flags.
 * - Degrades gracefully on unreadable state.
 *
 * Test coverage: tests/unit/quiet/quiet-daily-review-builder.test.ts
 */
import { readActionClosuresByDay, writeQuietDailyReview, } from "../../../storage/v8-state-stores.js";
// ───────────────────────────────────────────────────────────────
// Config
// ───────────────────────────────────────────────────────────────
const QUIET_MAX_CLOSURES_PER_DAY = 200;
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
    const sourceRefs = closures.map(buildSourceRefFromClosure);
    // Collect memory-review candidates from closure payloads
    const memoryCandidates = [];
    for (const closure of closures) {
        const payload = parsePayloadJson(closure.payloadJson);
        if (payload.memoryReviewCandidate) {
            memoryCandidates.push(payload.memoryReviewCandidate);
        }
    }
    // Build summary
    const completedCount = closures.filter((c) => c.status === "completed").length;
    const deniedCount = closures.filter((c) => c.status === "denied").length;
    const failedCount = closures.filter((c) => c.status === "failed").length;
    const reviewSummary = `Day ${day}: ${closures.length} closures (${completedCount} completed, ${deniedCount} denied, ${failedCount} failed)`;
    const importanceSignals = [];
    if (memoryCandidates.length > 0) {
        importanceSignals.push(`${memoryCandidates.length} memory-review candidates`);
    }
    if (failedCount > 0) {
        importanceSignals.push(`${failedCount} failed actions`);
    }
    const reviewId = `quiet_${day}`;
    const writeResult = await writeQuietDailyReview(db, {
        id: reviewId,
        createdAt: now,
        day,
        closureCount: closures.length,
        memoryCandidateCount: memoryCandidates.length,
        sourceRefs,
        redactionClass: "none",
        lifecycleStatus: "pending",
        payloadJson: JSON.stringify({
            reviewSummary,
            importanceSignals,
            memoryCandidates,
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
            reviewSummary,
            importanceSignals,
            createdAt: now,
        },
    };
}
