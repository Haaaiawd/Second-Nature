/**
 * DreamInputLoader — T-DQS.C.2 (DR-026: Idempotent Claim Loading)
 *
 * Core logic: Load unreferenced QuietClaims as Dream inputs.
 *
 * Idempotent mechanism (DR-026):
 * - Queries daily_diary_index + life_evidence_index for candidate source refs.
 * - Excludes refs already consumed by accepted dream_output_index projections.
 * - When Dream lock is held, claims are queued; on next Dream run after lock release,
 *   they are automatically included (no separate "skipped" tracking needed).
 * - Subsequent Dream runs exclude already-accepted refs, preventing re-processing.
 *
 * Lock semantics:
 * - Lock TTL is 35min (enforced by DreamScheduler, not this module).
 * - This loader only reads; lock enforcement is upstream.
 *
 * ToolExperience summaries:
 * - Loads recent tool_experience records aggregated by (connector_id, capability_id, outcome).
 * - Provides frequency count and last recorded time for Dream insight extraction.
 *
 * Contract:
 * - Returns empty evidenceRefs when no unreferenced claims exist.
 * - Never fabricates inputs; only reads from existing DB state.
 *
 * Performance: O(n) where n = life_evidence_index rows (capped by LIMIT).
 * Memory: O(m) where m = deduplicated ref count (typically < evidenceLimit).
 *
 * Test coverage: tests/unit/dream/dream-input-loader.test.ts
 */
function safeParseJson(json, fallback) {
    try {
        const parsed = JSON.parse(json);
        return parsed ?? fallback;
    }
    catch {
        return fallback;
    }
}
/** Extract ref ids from JSON that may be string[] or {id?, sourceId?}[] */
function extractRefIdsFromJson(json) {
    const parsed = safeParseJson(json, []);
    if (!Array.isArray(parsed))
        return [];
    const ids = [];
    for (const item of parsed) {
        if (typeof item === "string") {
            ids.push(item);
        }
        else if (item && typeof item === "object" && !Array.isArray(item)) {
            const obj = item;
            if (typeof obj.id === "string")
                ids.push(obj.id);
            if (typeof obj.sourceId === "string")
                ids.push(obj.sourceId);
        }
    }
    return ids;
}
/** Extract consumed ref ids from canonical_entries_json (CanonicalMemoryEntry[]) */
function extractConsumedRefIdsFromEntriesJson(json) {
    const entries = safeParseJson(json, []);
    if (!Array.isArray(entries))
        return [];
    const ids = [];
    for (const entry of entries) {
        if (entry && typeof entry === "object" && !Array.isArray(entry)) {
            const sourceRefs = entry.sourceRefs;
            if (Array.isArray(sourceRefs)) {
                for (const sr of sourceRefs) {
                    if (typeof sr === "string") {
                        ids.push(sr);
                    }
                    else if (sr && typeof sr === "object" && !Array.isArray(sr)) {
                        const obj = sr;
                        if (typeof obj.sourceId === "string")
                            ids.push(obj.sourceId);
                        if (typeof obj.id === "string")
                            ids.push(obj.id);
                    }
                }
            }
        }
    }
    return ids;
}
export function createDreamInputLoader(options) {
    const { sqlite } = options.database;
    return {
        // async aligns with DreamStatePort.loadDreamInputs signature (Promise<DreamInputBundle>).
        // All current operations are synchronous (sql.js in-memory), but the contract
        // reserves the right to use async DB drivers in the future.
        async loadDreamInputs(query = {}) {
            // Defaults from 05A_TASKS.md T-DQS.C.2 and dream-quiet-system.md §10.2
            const timeWindowDays = query.timeWindowDays ?? 30;
            const evidenceLimit = query.evidenceLimit ?? 1000;
            const since = new Date(Date.now() - timeWindowDays * 24 * 60 * 60 * 1000).toISOString();
            // ─── 1. Collect candidate ref ids from daily_diary_index ─────────────────
            const candidateRefs = new Set();
            const diaryResult = sqlite.exec(`SELECT source_refs_json FROM daily_diary_index WHERE created_at >= ? ORDER BY created_at DESC`, [since]);
            for (const row of diaryResult[0]?.values ?? []) {
                for (const id of extractRefIdsFromJson(String(row[0]))) {
                    candidateRefs.add(id);
                }
            }
            // ─── 2. Collect candidate ref ids from life_evidence_index ───────────────
            const evidenceResult = sqlite.exec(`SELECT source_refs_json FROM life_evidence_index WHERE timestamp >= ? ORDER BY timestamp DESC LIMIT ?`, [since, evidenceLimit]);
            for (const row of evidenceResult[0]?.values ?? []) {
                for (const id of extractRefIdsFromJson(String(row[0]))) {
                    candidateRefs.add(id);
                }
            }
            // ─── 3. Collect consumed refs from accepted dream outputs ────────────────
            const consumedRefs = new Set();
            const acceptedResult = sqlite.exec(`SELECT canonical_entries_json FROM dream_output_index WHERE status = 'accepted'`);
            for (const row of acceptedResult[0]?.values ?? []) {
                for (const id of extractConsumedRefIdsFromEntriesJson(String(row[0]))) {
                    consumedRefs.add(id);
                }
            }
            // ─── 4. Filter: keep only refs not consumed by accepted projections ──────
            const evidenceRefs = [...candidateRefs].filter((ref) => !consumedRefs.has(ref));
            // ─── 5. Load ToolExperience summaries (aggregated by connector/capability/outcome) ─
            const toolExpResult = sqlite.exec(`SELECT connector_id, capability_id, outcome, COUNT(*) as count, MAX(created_at) as last_recorded_at
         FROM tool_experience
         WHERE created_at >= ?
         GROUP BY connector_id, capability_id, outcome
         ORDER BY last_recorded_at DESC
         LIMIT ?`, [since, evidenceLimit]);
            const toolExperienceSummaries = [];
            for (const row of toolExpResult[0]?.values ?? []) {
                toolExperienceSummaries.push({
                    connectorId: String(row[0]),
                    capabilityId: String(row[1]),
                    outcome: String(row[2]),
                    count: Number(row[3]),
                    lastRecordedAt: String(row[4]),
                });
            }
            return {
                evidenceRefs,
                chronicleEntryIds: [],
                activeMemoryStoreId: undefined,
                narrativeSnapshotId: undefined,
                relationshipSnapshotId: undefined,
                goalSnapshotIds: [],
                toolExperienceSummaries,
                inputCounts: {
                    evidence: evidenceRefs.length,
                    chronicle: 0, // T-DQS.C.2 scope: evidence only; chronicle loaded separately
                    memoryEntries: 0, // T-DQS.C.2 scope: evidence only; memory loaded separately
                },
            };
        },
    };
}
