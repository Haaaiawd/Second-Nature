/**
 * v9 Digest Assembler & Timeline Query Service (T8.2.3).
 *
 * Extends digest/timeline to support loop, continuity, routine, connector
 * evolution, and character events with redacted query and pagination.
 *
 * Core logic:
 * - `assembleDigest`: aggregate health sections + sourceRefCount + redacted output
 * - `queryTimeline`: filter by family/kind/sourceRef + paginate + clamp window
 * - `clampTimelineWindow`: enforce TIMELINE_MAX_WINDOW_DAYS
 * - `computeDigestWindow`: default 24h window
 * - `countUniqueSourceRefs`: deduplicate source refs across events + ledger
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/observability-recovery-system.detail.md §3.8 §3.9 §5.6 §5.7`
 * - `.anws/v9/04_SYSTEM_DESIGN/observability-recovery-system.md §5.1`
 * - ADR-006
 *
 * Dependencies:
 * - `src/observability/v9-loop-health-aggregator.js` (aggregateLoopStatus)
 * - `src/observability/v9-redaction-projector.js` (redactTimelinePayload)
 * - `src/shared/types/v9-contracts.js` (Digest, TimelineRow, TimelinePage)
 *
 * Boundary:
 * - Pure functions with injectable deps (auditStore, now, generateId).
 * - Timeline output is redacted via redactTimelinePayload.
 * - Character frame event kind whitelist enforced (§1.5a).
 * - No emotion/personality/identity-lock text in output (ADR-006).
 *
 * Test coverage: `tests/unit/observability/v9-digest-timeline.test.ts`
 */
import type { Digest, TimelinePage, TimelineFamily, SourceRef, CharacterFrameEventKind } from "../shared/types/v9-contracts.js";
import { type LoopStatusInputs } from "./v9-loop-health-aggregator.js";
export declare const DIGEST_PERF: {
    readonly DIGEST_DEFAULT_WINDOW_HOURS: 24;
    readonly TIMELINE_DEFAULT_LIMIT: 50;
    readonly TIMELINE_MAX_LIMIT: 100;
    readonly TIMELINE_MAX_WINDOW_DAYS: 7;
};
export declare const CHARACTER_FRAME_EVENT_KINDS: CharacterFrameEventKind[];
export interface DigestRequest {
    workspaceRoot: string;
    windowStart?: string;
    windowEnd?: string;
    windowHours?: number;
}
export interface TimelineQueryRequest {
    workspaceRoot: string;
    windowStart?: string;
    windowEnd?: string;
    family?: TimelineFamily;
    kind?: string;
    sourceRef?: string;
    limit?: number;
    cursor?: string;
}
export interface TimelineRowInput {
    id: string;
    occurredAt: string;
    family: TimelineFamily;
    kind: string;
    sourceRefs: SourceRef[];
    redactedPayloadJson?: string;
    reasonCode: string;
}
export interface DigestAssemblerDeps {
    now: () => Date;
    generateId: () => string;
    /** Persist digest row (optional — caller may skip). */
    persistDigest?: (digest: Digest) => Promise<void>;
}
export interface TimelineQueryDeps {
    /** Query timeline rows from store (already filtered by store). */
    queryRows: (params: {
        start: string;
        end: string;
        family?: TimelineFamily;
        kind?: string;
        sourceRef?: string;
        limit: number;
        cursor?: string;
    }) => Promise<TimelineRowInput[]>;
}
export interface TimeWindow {
    start: string;
    end: string;
    hours: number;
}
export declare function computeDigestWindow(request: DigestRequest, now: Date): TimeWindow;
export declare function clampTimelineWindow(request: TimelineQueryRequest, now: Date): TimeWindow;
export declare function countUniqueSourceRefs(events: {
    sourceRefs?: SourceRef[];
}[]): number;
export interface DigestAssemblerInputs extends LoopStatusInputs {
    /** Ledger entries for sourceRefCount. */
    ledgerEntries?: {
        sourceRefs: SourceRef[];
    }[];
}
export declare function assembleDigest(deps: DigestAssemblerDeps, inputs: DigestAssemblerInputs, request: DigestRequest): Promise<Digest>;
export declare function queryTimeline(deps: TimelineQueryDeps, request: TimelineQueryRequest, now: Date): Promise<TimelinePage>;
/**
 * Filter timeline rows to only include character frame events
 * with whitelisted kinds (§1.5a).
 */
export declare function filterCharacterFrameEvents(rows: TimelineRowInput[]): TimelineRowInput[];
