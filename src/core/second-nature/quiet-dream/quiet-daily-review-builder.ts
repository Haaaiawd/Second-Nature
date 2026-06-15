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

import type { StateDatabase } from "../../../storage/db/index.js";
import {
  readActionClosuresByDay,
  writeQuietDailyReview,
  readPerceptionCardById,
  readEvidenceItemsByDay,
  readPerceptionCardsByDay,
} from "../../../storage/v8-state-stores.js";
import type {
  SourceRef,
  DegradedOperationResult,
  V8ReasonCode,
  MemoryReviewCandidateClosure,
} from "../../../shared/types/v8-contracts.js";

// ───────────────────────────────────────────────────────────────
// Config
// ───────────────────────────────────────────────────────────────

const QUIET_MAX_CLOSURES_PER_DAY = 200;
const QUIET_REVIEW_MAX_MEMORY_CANDIDATES = 20;

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

export interface QuietReviewEntry {
  closureId: string;
  platformId?: string;
  actionKind?: string;
  status: string;
  summary?: string;
  reason?: string;
}

export interface QuietDailyReviewResult {
  id: string;
  day: string;
  closureCount: number;
  memoryCandidateCount: number;
  /** Generic source refs (closure + perception + other) */
  sourceRefs: SourceRef[];
  /** Explicit closure refs — first-class provenance for reviewed ActionClosureRecords */
  closureRefs: SourceRef[];
  reviewSummary: string;
  /** Human-readable review sections */
  sections: QuietReviewSection[];
  importanceSignals: string[];
  createdAt: string;
}

export interface QuietReviewSection {
  kind: "headline" | "completed" | "deferred" | "failed" | "memory_candidates" | "observations";
  title: string;
  lines: string[];
}

export interface BuildQuietDailyReviewOptions {
  day?: string;
  now?: string;
}

export type BuildQuietDailyReviewOutput =
  | { status: "completed"; review: QuietDailyReviewResult }
  | { status: "empty"; reason: V8ReasonCode }
  | DegradedOperationResult;

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

function todayString(now: string): string {
  return now.slice(0, 10);
}

function parsePayloadJson(json: string | null): Record<string, unknown> {
  if (!json) return {};
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function buildSourceRefFromClosure(closure: { id: string; cycleId: string; reason: string | null }): SourceRef {
  return {
    uri: `sn://closure/${closure.id}`,
    family: "action_closure",
    id: closure.id,
    redactionClass: "none",
    resolveStatus: "resolvable",
  };
}

function parseSourceRefs(json: string | null): SourceRef[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildSourceRefFromEvidence(evidence: { id: string; sourceRefsJson: string | null }): SourceRef {
  const refs = parseSourceRefs(evidence.sourceRefsJson);
  return (
    refs[0] ?? {
      uri: `sn://evidence/${evidence.id}`,
      family: "evidence",
      id: evidence.id,
      redactionClass: "none",
      resolveStatus: "resolvable",
    }
  );
}

function buildSourceRefFromPerception(perception: { id: string; sourceRefsJson: string | null }): SourceRef {
  const refs = parseSourceRefs(perception.sourceRefsJson);
  return (
    refs[0] ?? {
      uri: `sn://perception/${perception.id}`,
      family: "perception",
      id: perception.id,
      redactionClass: "none",
      resolveStatus: "resolvable",
    }
  );
}

function renderActionKind(actionKind?: string): string {
  if (!actionKind) return "action";
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

function renderClosureLine(entry: QuietReviewEntry): string {
  const platform = entry.platformId ?? "system";
  const action = renderActionKind(entry.actionKind);
  const reason = entry.reason ? ` (${entry.reason})` : "";
  const summary = entry.summary ? `: ${entry.summary}` : "";
  return `- ${platform} ${action}${summary}${reason} [${entry.closureId}]`;
}

function groupByStatus(entries: QuietReviewEntry[]): Record<string, QuietReviewEntry[]> {
  const groups: Record<string, QuietReviewEntry[]> = {};
  for (const entry of entries) {
    if (!groups[entry.status]) groups[entry.status] = [];
    groups[entry.status].push(entry);
  }
  return groups;
}

// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────

export async function buildQuietDailyReview(
  db: StateDatabase,
  options?: BuildQuietDailyReviewOptions,
): Promise<BuildQuietDailyReviewOutput> {
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

  const closureRefs: SourceRef[] = closures.map(buildSourceRefFromClosure);
  let sourceRefs: SourceRef[] = [...closureRefs];

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
  const entries: QuietReviewEntry[] = [];
  const memoryCandidates: MemoryReviewCandidateClosure[] = [];
  const notableSignals: string[] = [];

  for (const closure of closures) {
    const payload = parsePayloadJson(closure.payloadJson);
    let summary: string | undefined;
    let actionKind: string | undefined;

    const perceptionId = payload.perceptionCardId as string | undefined;
    if (perceptionId) {
      const perceptionRead = await readPerceptionCardById(db, perceptionId);
      if (!perceptionRead.degraded && perceptionRead.row) {
        summary = perceptionRead.row.summary ?? undefined;
        const perceptionPayload = parsePayloadJson(perceptionRead.row.payloadJson);
        if (perceptionPayload.possibleIntents && Array.isArray(perceptionPayload.possibleIntents)) {
          actionKind = perceptionPayload.possibleIntents[0] as string;
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
      memoryCandidates.push(payload.memoryReviewCandidate as MemoryReviewCandidateClosure);
    }
  }

  for (const perception of perceptionRows) {
    if (perception.summary) {
      notableSignals.push(`Perception: ${perception.summary}`);
    }
  }
  for (const evidence of evidenceRows) {
    const payload = parsePayloadJson(evidence.payloadJson);
    if (payload.summary) {
      notableSignals.push(`${evidence.platformId}: ${String(payload.summary)}`);
    } else if (payload.title) {
      notableSignals.push(`${evidence.platformId}: ${String(payload.title)}`);
    }
  }

  const groups = groupByStatus(entries);

  // Build sections
  const sections: QuietReviewSection[] = [];

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
      lines: displayCandidates.map((c) =>
        `- ${c.topicKey ?? "memory candidate"}${c.memoryIntentReason ? ` (${c.memoryIntentReason})` : ""} [${c.perceptionRef?.id ?? "?"}]`
      ),
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

  const importanceSignals: string[] = [];
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
