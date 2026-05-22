/**
 * InteractionSnapshotProjector — T-SMS.C.4
 *
 * Core logic: Redact recent conversation into summary-only snapshots.
 * No raw private message content stored — only summary + contentRef.
 * DR-022: raw private content rejected by WriteValidationGate upstream.
 *
 * Dependencies: session_chronicle table (existing v6 schema)
 */
export function createInteractionSnapshotProjector(database) {
    const { sqlite } = database;
    return {
        async loadRecentInteractionSnapshot(limit = 10) {
            const result = sqlite.exec(`SELECT entry_id, actor, summary, result, occurred_at,
                source_refs_json, related_decision_id
         FROM session_chronicle
         WHERE event_kind IN ('interaction', 'owner_reply', 'outreach_sent')
         ORDER BY occurred_at DESC
         LIMIT ${limit}`);
            if (result.length === 0 || result[0].values.length === 0)
                return [];
            const cols = result[0].columns;
            const get = (row, name) => row[cols.indexOf(name)];
            return result[0].values.map((row) => ({
                interactionId: get(row, "entry_id"),
                platformId: "unknown", // session_chronicle has no platform_id column
                summary: get(row, "summary"),
                contentRef: get(row, "related_decision_id") ?? undefined,
                isReply: get(row, "result") === "reply",
                repliedAt: undefined,
                createdAt: get(row, "occurred_at"),
            }));
        },
    };
}
