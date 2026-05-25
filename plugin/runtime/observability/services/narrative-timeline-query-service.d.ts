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
/** A single entry in the narrative timeline (read model). */
export interface NarrativeTimelineEntry {
    version: string;
    timestamp: string;
    triggerKind: "heartbeat.decision" | "goal.transition" | "restore.applied" | "dream.projection" | "owner.override";
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
    field: "focus" | "progress" | "nextIntent" | "toneSignal" | "acceptedGoalId" | "sourceRefs";
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
    listNarrativeTimeline(from: string, to: string, opts?: {
        limit?: number;
        afterTimestamp?: string;
    }): Promise<NarrativeTimelineRow[]>;
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
export declare class NarrativeQueryRangeError extends Error {
    readonly code: "query_range_exceeded";
    constructor(rangeDays: number);
}
export declare class NarrativeVersionNotFoundError extends Error {
    readonly code: "narrative_version_not_found";
    constructor(version: string);
}
/**
 * A cursor is a base64url-encoded JSON object: { ts: string }.
 * `ts` is the ISO timestamp of the last entry returned on the previous page.
 * The next page fetches rows with createdAt > ts.
 */
export declare function encodeCursor(lastTimestamp: string): string;
export declare function decodeCursor(cursor: string): {
    ts: string;
};
/**
 * Query narrative timeline entries with cursor-based pagination.
 *
 * @throws NarrativeQueryRangeError  when (to - from) > 90 days
 */
export declare function queryNarrativeTimeline(from: string, to: string, opts: {
    limit?: number;
    cursor?: string;
}, deps: NarrativeTimelineDeps): Promise<NarrativeTimelinePage>;
export declare function queryNarrativeDiff(fromVersion: string, toVersion: string, deps: NarrativeTimelineDeps): Promise<NarrativeDiff>;
