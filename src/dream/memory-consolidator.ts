/**
 * Rules-based memory consolidation.
 *
 * Core logic: dedupe, merge, stale cleanup, and conflict marking on evidence,
 * chronicle, and existing memory entries. No LLM required.
 *
 * - Deduplicate by sourceRef id + kind; keep the most recent.
 * - Merge entries with same kind + similar summary (naive prefix match).
 * - Mark entries older than 90 days as stale (retain but flag).
 * - Mark entries with conflicting sourceRefs as conflict.
 * Test coverage: tests/integration/dream/t7-1-1-dream-pipeline.test.ts
 */

import type {
  CanonicalMemoryEntry,
  SourceRef,
} from "../storage/memory-store/memory-store-lifecycle.js";

export interface ConsolidationInput {
  evidenceSummaries: Array<{
    id: string;
    summary: string;
    sourceRefs: SourceRef[];
    createdAt: string;
    sensitivity?: string;
  }>;
  chronicleSummaries: Array<{
    id: string;
    summary: string;
    sourceRefs: SourceRef[];
    createdAt: string;
  }>;
  toolExperienceSummaries?: Array<{
    id: string;
    summary: string;
    sourceRefs: SourceRef[];
    createdAt: string;
  }>;
  existingEntries: CanonicalMemoryEntry[];
}

export interface ConsolidationResult {
  entries: CanonicalMemoryEntry[];
  conflicts: Array<{ entryId: string; reason: string }>;
  staleCount: number;
  dedupeCount: number;
}

const STALE_DAYS = 90;

function isStale(createdAt: string): boolean {
  const then = new Date(createdAt).getTime();
  const now = Date.now();
  return now - then > STALE_DAYS * 24 * 60 * 60 * 1000;
}

function keyForSourceRefs(refs: SourceRef[]): string {
  return refs
    .map((r) => `${r.sourceId}:${r.kind}`)
    .sort()
    .join("|");
}

function summariesSimilar(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 5)
      .join(" ");
  return norm(a) === norm(b);
}

export function consolidateMemory(
  input: ConsolidationInput,
): ConsolidationResult {
  const allRaw = [
    ...input.evidenceSummaries.map((e) => ({
      ...e,
      origin: "evidence" as const,
    })),
    ...input.chronicleSummaries.map((c) => ({
      ...c,
      origin: "chronicle" as const,
    })),
    ...(input.toolExperienceSummaries ?? []).map((t) => ({
      ...t,
      origin: "tool_experience" as const,
    })),
    ...input.existingEntries.map((e) => ({
      id: e.entryId,
      summary: e.summary,
      sourceRefs: e.sourceRefs,
      createdAt: e.createdAt,
      origin: "memory" as const,
    })),
  ];

  // 1. Deduplicate by sourceRef key, keep most recent
  const bySourceKey = new Map<string, typeof allRaw[0]>();
  for (const item of allRaw) {
    const key = keyForSourceRefs(item.sourceRefs);
    const existing = bySourceKey.get(key);
    if (!existing || item.createdAt > existing.createdAt) {
      bySourceKey.set(key, item);
    }
  }
  const deduped = Array.from(bySourceKey.values());
  const dedupeCount = allRaw.length - deduped.length;

  // 2. Merge similar summaries
  const merged: CanonicalMemoryEntry[] = [];
  const used = new Set<string>();
  for (const item of deduped) {
    if (used.has(item.id)) continue;
    const group = [item];
    for (const other of deduped) {
      if (other.id === item.id || used.has(other.id)) continue;
      if (summariesSimilar(item.summary, other.summary)) {
        group.push(other);
        used.add(other.id);
      }
    }
    used.add(item.id);

    const mergedRefs: SourceRef[] = [];
    const seenRefKeys = new Set<string>();
    for (const g of group) {
      for (const ref of g.sourceRefs) {
        const rk = `${ref.sourceId}:${ref.kind}`;
        if (!seenRefKeys.has(rk)) {
          seenRefKeys.add(rk);
          mergedRefs.push(ref);
        }
      }
    }

    const latestCreatedAt = group
      .map((g) => g.createdAt)
      .sort()
      .at(-1)!;

    merged.push({
      entryId: `consolidated:${crypto.randomUUID()}`,
      kind: group[0]!.origin,
      summary: group[0]!.summary,
      sourceRefs: mergedRefs,
      createdAt: latestCreatedAt,
    });
  }

  // 3. Stale marking
  let staleCount = 0;
  for (const entry of merged) {
    if (isStale(entry.createdAt)) {
      staleCount++;
    }
  }

  // 4. Conflict detection: entries with overlapping sourceRefs but different summaries
  const conflicts: Array<{ entryId: string; reason: string }> = [];
  for (let i = 0; i < merged.length; i++) {
    for (let j = i + 1; j < merged.length; j++) {
      const a = merged[i]!;
      const b = merged[j]!;
      const aKeys = new Set(a.sourceRefs.map((r) => `${r.sourceId}:${r.kind}`));
      const overlap = b.sourceRefs.some((r) =>
        aKeys.has(`${r.sourceId}:${r.kind}`),
      );
      if (overlap && !summariesSimilar(a.summary, b.summary)) {
        conflicts.push({
          entryId: a.entryId,
          reason: `conflict_with:${b.entryId}`,
        });
        conflicts.push({
          entryId: b.entryId,
          reason: `conflict_with:${a.entryId}`,
        });
      }
    }
  }

  return {
    entries: merged,
    conflicts,
    staleCount,
    dedupeCount,
  };
}
