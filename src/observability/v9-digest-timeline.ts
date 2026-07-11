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

import type {
  Digest,
  TimelineRow,
  TimelinePage,
  TimelineFamily,
  SourceRef,
  CharacterFrameEventKind,
} from "../shared/types/v9-contracts.js";
import {
  aggregateLoopStatus,
  type LoopStatusInputs,
  type StageEventInput,
  type CycleTraceInput,
  type ActivityThreadHealthOutput,
  type SelfContinuityCardAssemblyResultInput,
  type ToolRoutineRegistrySnapshotInput,
  type ConnectorEvolutionResultInput,
  type CharacterFrameEventInput,
} from "./v9-loop-health-aggregator.js";
import { redactTimelinePayload } from "./v9-redaction-projector.js";

// ───────────────────────────────────────────────────────────────
// Config constants (§1.8)
// ───────────────────────────────────────────────────────────────

export const DIGEST_PERF = {
  DIGEST_DEFAULT_WINDOW_HOURS: 24,
  TIMELINE_DEFAULT_LIMIT: 50,
  TIMELINE_MAX_LIMIT: 100,
  TIMELINE_MAX_WINDOW_DAYS: 7,
} as const;

// ───────────────────────────────────────────────────────────────
// Character frame event kind whitelist (§1.5a)
// ───────────────────────────────────────────────────────────────

export const CHARACTER_FRAME_EVENT_KINDS: CharacterFrameEventKind[] = [
  "refresh",
  "accepted",
  "rejected",
  "revised",
  "retired",
  "superseded",
  "deferred",
  "conflict",
];

// ───────────────────────────────────────────────────────────────
// Input types
// ───────────────────────────────────────────────────────────────

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

// ───────────────────────────────────────────────────────────────
// Window computation
// ───────────────────────────────────────────────────────────────

export interface TimeWindow {
  start: string;
  end: string;
  hours: number;
}

export function computeDigestWindow(
  request: DigestRequest,
  now: Date,
): TimeWindow {
  const hours = request.windowHours ?? DIGEST_PERF.DIGEST_DEFAULT_WINDOW_HOURS;
  const end = request.windowEnd ?? now.toISOString();
  const start = request.windowStart ?? new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
  return { start, end, hours };
}

export function clampTimelineWindow(
  request: TimelineQueryRequest,
  now: Date,
): TimeWindow {
  const maxMs = DIGEST_PERF.TIMELINE_MAX_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const end = request.windowEnd ?? now.toISOString();
  const requestedStart = request.windowStart ?? new Date(now.getTime() - maxMs).toISOString();
  const startMs = new Date(requestedStart).getTime();
  const endMs = new Date(end).getTime();
  const actualStartMs = Math.max(startMs, endMs - maxMs);
  const hours = Math.round((endMs - actualStartMs) / (60 * 60 * 1000));
  return {
    start: new Date(actualStartMs).toISOString(),
    end,
    hours,
  };
}

// ───────────────────────────────────────────────────────────────
// Source ref counting
// ───────────────────────────────────────────────────────────────

export function countUniqueSourceRefs(
  events: { sourceRefs?: SourceRef[] }[],
): number {
  const seen = new Set<string>();
  for (const event of events) {
    if (!event.sourceRefs) continue;
    for (const ref of event.sourceRefs) {
      seen.add(`${ref.family}:${ref.id}`);
    }
  }
  return seen.size;
}

// ───────────────────────────────────────────────────────────────
// assembleDigest (§3.8)
// ───────────────────────────────────────────────────────────────

export interface DigestAssemblerInputs extends LoopStatusInputs {
  /** Ledger entries for sourceRefCount. */
  ledgerEntries?: { sourceRefs: SourceRef[] }[];
}

export async function assembleDigest(
  deps: DigestAssemblerDeps,
  inputs: DigestAssemblerInputs,
  request: DigestRequest,
): Promise<Digest> {
  const now = deps.now();
  const window = computeDigestWindow(request, now);

  // Aggregate all health dimensions
  const loopStatus = aggregateLoopStatus(inputs, {
    currentCycleSequence: 0, // digest doesn't have a specific cycle
    windowHours: window.hours,
  });

  // Count unique source refs across stage events + ledger
  const allRefs: { sourceRefs?: SourceRef[] }[] = [
    ...inputs.stageEvents.map((e) => ({
      sourceRefs: [{ family: "ledger" as const, id: e.stageKind }],
    })),
    ...(inputs.ledgerEntries ?? []),
  ];
  const sourceRefCount = countUniqueSourceRefs(allRefs);

  const digest: Digest = {
    id: deps.generateId(),
    windowStart: window.start,
    windowEnd: window.end,
    sections: {
      loop: loopStatus.loop,
      continuity: loopStatus.continuity,
      routine: loopStatus.routine,
      connectorEvolution: loopStatus.connectorEvolution,
    },
    sourceRefCount,
    generatedAt: now.toISOString(),
  };

  if (deps.persistDigest) {
    await deps.persistDigest(digest);
  }

  return digest;
}

// ───────────────────────────────────────────────────────────────
// queryTimeline (§3.9)
// ───────────────────────────────────────────────────────────────

export async function queryTimeline(
  deps: TimelineQueryDeps,
  request: TimelineQueryRequest,
  now: Date,
): Promise<TimelinePage> {
  const window = clampTimelineWindow(request, now);
  const limit = Math.min(
    request.limit ?? DIGEST_PERF.TIMELINE_DEFAULT_LIMIT,
    DIGEST_PERF.TIMELINE_MAX_LIMIT,
  );

  // Query limit+1 to detect hasMore
  const rows = await deps.queryRows({
    start: window.start,
    end: window.end,
    family: request.family,
    kind: request.kind,
    sourceRef: request.sourceRef,
    limit: limit + 1,
    cursor: request.cursor,
  });

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? pageRows[pageRows.length - 1].id : undefined;

  // Redact payload on read
  const redactedRows: TimelineRow[] = pageRows.map((r) => {
    const redactionResult = redactTimelinePayload(r.redactedPayloadJson ?? "");
    return {
      id: r.id,
      occurredAt: r.occurredAt,
      family: r.family,
      kind: r.kind,
      sourceRefs: r.sourceRefs,
      redactedPayloadJson: redactionResult.json || undefined,
      reasonCode: r.reasonCode,
    };
  });

  return {
    rows: redactedRows,
    nextCursor,
  };
}

// ───────────────────────────────────────────────────────────────
// Character frame event kind whitelist filter (§1.5a)
// ───────────────────────────────────────────────────────────────

/**
 * Filter timeline rows to only include character frame events
 * with whitelisted kinds (§1.5a).
 */
export function filterCharacterFrameEvents(
  rows: TimelineRowInput[],
): TimelineRowInput[] {
  const whitelist = new Set<string>(CHARACTER_FRAME_EVENT_KINDS);
  return rows.filter(
    (r) => r.family === "character_frame_event" && whitelist.has(r.kind),
  );
}
