/**
 * NarrativeTimelineQueryService — T-OBS.C.5
 *
 * Core logic:
 *   cursor-based pagination over narrative timeline entries (DR-037).
 *   A cursor encodes the ISO timestamp of the last-seen entry; the next
 *   page starts strictly after that timestamp.
 *
 *   queryNarrativeTimeline:
 *     - Accepts optional cursor + limit (default 20, max 30).
 *     - Validates that (to - from) ≤ 90 days; throws query_range_exceeded otherwise.
 *     - Fetches (limit + 1) rows to detect whether a next page exists.
 *     - Returns NarrativeTimelinePage with entries + optional nextCursor.
 *
 *   queryNarrativeDiff:
 *     - Compares two named versions across DIFF_FIELDS.
 *     - Computes sourceRefs set-difference (added / removed).
 *     - Propagates reasonCode from the *to* snapshot.
 *
 * DR-037: cursor pagination; 90-day upper bound; no offset pagination.
 * DR-032: if state-memory is unavailable, returns degraded placeholder.
 *
 * Test coverage: tests/unit/observability/narrative-timeline-query.test.ts
 */
// ─── Config ──────────────────────────────────────────────────────────────────
const MAX_RANGE_DAYS = 90;
const MAX_VERSIONS_PER_PAGE = 30;
const DEFAULT_PAGE_LIMIT = 20;
// ─── Error types ─────────────────────────────────────────────────────────────
export class NarrativeQueryRangeError extends Error {
    code = "query_range_exceeded";
    constructor(rangeDays) {
        super(`query_range_exceeded: requested range ${rangeDays} days exceeds maximum ${MAX_RANGE_DAYS} days`);
        this.name = "NarrativeQueryRangeError";
    }
}
export class NarrativeVersionNotFoundError extends Error {
    code = "narrative_version_not_found";
    constructor(version) {
        super(`narrative_version_not_found: ${version}`);
        this.name = "NarrativeVersionNotFoundError";
    }
}
// ─── Helpers ─────────────────────────────────────────────────────────────────
function daysBetween(from, to) {
    const ms = new Date(to).getTime() - new Date(from).getTime();
    return ms / (1000 * 60 * 60 * 24);
}
function validateRange(from, to) {
    const range = daysBetween(from, to);
    if (range > MAX_RANGE_DAYS) {
        throw new NarrativeQueryRangeError(Math.ceil(range));
    }
}
function clampLimit(requested) {
    if (requested === undefined || requested <= 0)
        return DEFAULT_PAGE_LIMIT;
    return Math.min(requested, MAX_VERSIONS_PER_PAGE);
}
function mapRow(row) {
    return {
        version: row.version,
        timestamp: row.createdAt,
        triggerKind: row.triggerKind,
        sourceRefs: row.sourceRefs ?? [],
        reasonCode: row.reasonCode ?? undefined,
        summaryText: row.summaryText ?? undefined,
    };
}
// ─── Cursor encoding ─────────────────────────────────────────────────────────
/**
 * A cursor is a base64url-encoded JSON object: { ts: string }.
 * `ts` is the ISO timestamp of the last entry returned on the previous page.
 * The next page fetches rows with createdAt > ts.
 */
export function encodeCursor(lastTimestamp) {
    return Buffer.from(JSON.stringify({ ts: lastTimestamp })).toString("base64url");
}
export function decodeCursor(cursor) {
    try {
        const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
        if (typeof parsed.ts !== "string")
            throw new Error("invalid cursor shape");
        return parsed;
    }
    catch {
        throw new Error(`invalid_cursor: ${cursor}`);
    }
}
// ─── Public API ──────────────────────────────────────────────────────────────
/**
 * Query narrative timeline entries with cursor-based pagination.
 *
 * @throws NarrativeQueryRangeError  when (to - from) > 90 days
 */
export async function queryNarrativeTimeline(from, to, opts, deps) {
    validateRange(from, to);
    const pageSize = clampLimit(opts.limit);
    // Decode cursor to get the afterTimestamp for this page
    const afterTimestamp = opts.cursor ? decodeCursor(opts.cursor).ts : undefined;
    // Fetch one extra to detect if there are more pages
    const rows = await deps.stateMemoryPort.listNarrativeTimeline(from, to, {
        limit: pageSize + 1,
        afterTimestamp,
    });
    const hasMore = rows.length > pageSize;
    const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
    const entries = pageRows.map(mapRow);
    const nextCursor = hasMore && pageRows.length > 0
        ? encodeCursor(pageRows[pageRows.length - 1].createdAt)
        : undefined;
    return {
        from,
        to,
        entries,
        nextCursor,
        truncated: hasMore,
    };
}
/**
 * Compare two narrative versions and return field-level diff.
 *
 * @throws NarrativeVersionNotFoundError  when either version is not found
 */
const DIFF_FIELDS = [
    "focus",
    "progress",
    "nextIntent",
    "toneSignal",
    "acceptedGoalId",
];
export async function queryNarrativeDiff(fromVersion, toVersion, deps) {
    const computedAt = (deps.now ?? (() => new Date().toISOString()))();
    const [fromSnap, toSnap] = await Promise.all([
        deps.stateMemoryPort.getNarrativeSnapshot(fromVersion),
        deps.stateMemoryPort.getNarrativeSnapshot(toVersion),
    ]);
    if (!fromSnap)
        throw new NarrativeVersionNotFoundError(fromVersion);
    if (!toSnap)
        throw new NarrativeVersionNotFoundError(toVersion);
    // Compare scalar diff fields
    const changes = [];
    for (const field of DIFF_FIELDS) {
        const fromVal = fromSnap[field] ?? null;
        const toVal = toSnap[field] ?? null;
        const fromStr = fromVal === null ? null : String(fromVal);
        const toStr = toVal === null ? null : String(toVal);
        if (fromStr !== toStr) {
            changes.push({ field, from: fromStr, to: toStr });
        }
    }
    // Compute sourceRefs set-difference
    const fromRefs = new Set(fromSnap.sourceRefs ?? []);
    const toRefs = new Set(toSnap.sourceRefs ?? []);
    const addedRefs = [...toRefs].filter((r) => !fromRefs.has(r));
    const removedRefs = [...fromRefs].filter((r) => !toRefs.has(r));
    return {
        fromVersion,
        toVersion,
        computedAt,
        changes,
        sourceRefChanges: { added: addedRefs, removed: removedRefs },
        reasonCode: toSnap.lastChangeReasonCode ?? undefined,
        isNoChange: changes.length === 0 &&
            addedRefs.length === 0 &&
            removedRefs.length === 0,
    };
}
