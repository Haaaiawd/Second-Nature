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
const STALE_DAYS = 90;
function isStale(createdAt) {
    const then = new Date(createdAt).getTime();
    const now = Date.now();
    return now - then > STALE_DAYS * 24 * 60 * 60 * 1000;
}
function keyForSourceRefs(refs) {
    return refs
        .map((r) => `${r.sourceId}:${r.kind}`)
        .sort()
        .join("|");
}
function summariesSimilar(a, b) {
    const norm = (s) => s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 5)
        .join(" ");
    return norm(a) === norm(b);
}
export function consolidateMemory(input) {
    const allRaw = [
        ...input.evidenceSummaries.map((e) => ({
            ...e,
            origin: "evidence",
        })),
        ...input.chronicleSummaries.map((c) => ({
            ...c,
            origin: "chronicle",
        })),
        ...(input.toolExperienceSummaries ?? []).map((t) => ({
            ...t,
            origin: "tool_experience",
        })),
        ...input.existingEntries.map((e) => ({
            id: e.entryId,
            summary: e.summary,
            sourceRefs: e.sourceRefs,
            createdAt: e.createdAt,
            origin: "memory",
        })),
    ];
    // 1. Deduplicate by sourceRef key, keep most recent
    const bySourceKey = new Map();
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
    const merged = [];
    const used = new Set();
    for (const item of deduped) {
        if (used.has(item.id))
            continue;
        const group = [item];
        for (const other of deduped) {
            if (other.id === item.id || used.has(other.id))
                continue;
            if (summariesSimilar(item.summary, other.summary)) {
                group.push(other);
                used.add(other.id);
            }
        }
        used.add(item.id);
        const mergedRefs = [];
        const seenRefKeys = new Set();
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
            .at(-1);
        merged.push({
            entryId: `consolidated:${crypto.randomUUID()}`,
            kind: group[0].origin,
            summary: group[0].summary,
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
    const conflicts = [];
    for (let i = 0; i < merged.length; i++) {
        for (let j = i + 1; j < merged.length; j++) {
            const a = merged[i];
            const b = merged[j];
            const aKeys = new Set(a.sourceRefs.map((r) => `${r.sourceId}:${r.kind}`));
            const overlap = b.sourceRefs.some((r) => aKeys.has(`${r.sourceId}:${r.kind}`));
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
