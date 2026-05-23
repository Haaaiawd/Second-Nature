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

// ─── Types ───────────────────────────────────────────────────────────────────

/** A single entry in the narrative timeline (read model). */
export interface NarrativeTimelineEntry {
  version: string;
  timestamp: string;
  triggerKind:
    | "heartbeat.decision"
    | "goal.transition"
    | "restore.applied"
    | "dream.projection"
    | "owner.override";
  sourceRefs: string[];
  reasonCode?: string;
  /** Human-readable change summary — pre-redacted, no raw private content */
  summaryText?: string;
}

/** A page of narrative timeline entries with optional next-page cursor. */
export interface NarrativeTimelinePage {
  from: string;
  to: string;
  entries: NarrativeTimelineEntry[];
  /** Opaque cursor: pass as `cursor` in the next call to get the next page */
  nextCursor?: string;
  /** True when the range was truncated because entries exceeded maxVersionsReturned */
  truncated: boolean;
}

/** Field change in a narrative diff */
export interface NarrativeFieldChange {
  field:
    | "focus"
    | "progress"
    | "nextIntent"
    | "toneSignal"
    | "acceptedGoalId"
    | "sourceRefs";
  from: string | null;
  to: string | null;
}

/** Diff between two narrative snapshots */
export interface NarrativeDiff {
  fromVersion: string;
  toVersion: string;
  computedAt: string;
  changes: NarrativeFieldChange[];
  sourceRefChanges: {
    added: string[];
    removed: string[];
  };
  reasonCode?: string;
  isNoChange: boolean;
}

// ─── Ports ───────────────────────────────────────────────────────────────────

/** Row shape returned by the state-memory store */
export interface NarrativeTimelineRow {
  version: string;
  createdAt: string;
  triggerKind: string;
  sourceRefs?: string[];
  reasonCode?: string;
  summaryText?: string;
}

/** Snapshot shape for diff computation */
export interface NarrativeSnapshotRow {
  version: string;
  focus?: unknown;
  progress?: unknown;
  nextIntent?: unknown;
  toneSignal?: unknown;
  acceptedGoalId?: unknown;
  sourceRefs?: string[];
  lastChangeReasonCode?: string;
}

/**
 * Port that the state-memory subsystem must implement.
 * Only the methods used here are declared — keeps the port minimal.
 */
export interface NarrativeTimelinePort {
  /**
   * Return timeline rows in ascending `createdAt` order.
   * @param from  ISO 8601 lower bound (inclusive)
   * @param to    ISO 8601 upper bound (inclusive)
   * @param opts  Optional pagination control
   */
  listNarrativeTimeline(
    from: string,
    to: string,
    opts?: { limit?: number; afterTimestamp?: string }
  ): Promise<NarrativeTimelineRow[]>;

  /**
   * Return a single snapshot by version string, or null if not found.
   */
  getNarrativeSnapshot(version: string): Promise<NarrativeSnapshotRow | null>;
}

/** Dependencies injected into query functions */
export interface NarrativeTimelineDeps {
  stateMemoryPort: NarrativeTimelinePort;
  /** Override for testability */
  now?: () => string;
}

// ─── Error types ─────────────────────────────────────────────────────────────

export class NarrativeQueryRangeError extends Error {
  readonly code = "query_range_exceeded" as const;
  constructor(rangeDays: number) {
    super(
      `query_range_exceeded: requested range ${rangeDays} days exceeds maximum ${MAX_RANGE_DAYS} days`
    );
    this.name = "NarrativeQueryRangeError";
  }
}

export class NarrativeVersionNotFoundError extends Error {
  readonly code = "narrative_version_not_found" as const;
  constructor(version: string) {
    super(`narrative_version_not_found: ${version}`);
    this.name = "NarrativeVersionNotFoundError";
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysBetween(from: string, to: string): number {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

function validateRange(from: string, to: string): void {
  const range = daysBetween(from, to);
  if (range > MAX_RANGE_DAYS) {
    throw new NarrativeQueryRangeError(Math.ceil(range));
  }
}

function clampLimit(requested?: number): number {
  if (requested === undefined || requested <= 0) return DEFAULT_PAGE_LIMIT;
  return Math.min(requested, MAX_VERSIONS_PER_PAGE);
}

function mapRow(row: NarrativeTimelineRow): NarrativeTimelineEntry {
  return {
    version: row.version,
    timestamp: row.createdAt,
    triggerKind: row.triggerKind as NarrativeTimelineEntry["triggerKind"],
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
export function encodeCursor(lastTimestamp: string): string {
  return Buffer.from(JSON.stringify({ ts: lastTimestamp })).toString("base64url");
}

export function decodeCursor(cursor: string): { ts: string } {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (typeof parsed.ts !== "string") throw new Error("invalid cursor shape");
    return parsed as { ts: string };
  } catch {
    throw new Error(`invalid_cursor: ${cursor}`);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Query narrative timeline entries with cursor-based pagination.
 *
 * @throws NarrativeQueryRangeError  when (to - from) > 90 days
 */
export async function queryNarrativeTimeline(
  from: string,
  to: string,
  opts: { limit?: number; cursor?: string },
  deps: NarrativeTimelineDeps
): Promise<NarrativeTimelinePage> {
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

  const nextCursor =
    hasMore && pageRows.length > 0
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
] as const;

type DiffableField = (typeof DIFF_FIELDS)[number];

export async function queryNarrativeDiff(
  fromVersion: string,
  toVersion: string,
  deps: NarrativeTimelineDeps
): Promise<NarrativeDiff> {
  const computedAt = (deps.now ?? (() => new Date().toISOString()))();

  const [fromSnap, toSnap] = await Promise.all([
    deps.stateMemoryPort.getNarrativeSnapshot(fromVersion),
    deps.stateMemoryPort.getNarrativeSnapshot(toVersion),
  ]);

  if (!fromSnap) throw new NarrativeVersionNotFoundError(fromVersion);
  if (!toSnap) throw new NarrativeVersionNotFoundError(toVersion);

  // Compare scalar diff fields
  const changes: NarrativeFieldChange[] = [];
  for (const field of DIFF_FIELDS) {
    const fromVal = fromSnap[field as DiffableField] ?? null;
    const toVal = toSnap[field as DiffableField] ?? null;
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
    isNoChange:
      changes.length === 0 &&
      addedRefs.length === 0 &&
      removedRefs.length === 0,
  };
}
