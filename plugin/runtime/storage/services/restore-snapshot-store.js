/**
 * RestoreSnapshotStore — T-SMS.C.6
 *
 * Core logic: Capture entity snapshots with a whitelist of 6 restorable kinds.
 * Automatically excludes sensitive kinds (credential, raw_private_message,
 * raw_prompt, encryption_key, session_token) per DR-017. Retains only the
 * most recent 3 snapshots by default.
 *
 * Dependencies:
 * - `StateDatabase` from `../db/index.js`
 * - `RestoreSnapshot`, `RestorableEntityKind`, `SensitiveExcludedKind`
 *   from `../../shared/types/v7-entities.js`
 *
 * Boundary:
 * - `captureSnapshot` silently drops any requested sensitive kinds.
 * - `loadLatestSnapshot` returns the most recent capture.
 * - `listSnapshots` orders by `captured_at` descending.
 *
 * Test coverage: tests/unit/storage/restore-snapshot-store.test.ts
 */
const ALL_RESTORABLE_KINDS = [
    "identity_profile",
    "agent_goal",
    "tool_experience",
    "daily_diary",
    "dream_output",
    "narrative_timeline",
];
const DEFAULT_EXCLUDED_KINDS = [
    "credential",
    "raw_private_message",
    "raw_prompt",
    "encryption_key",
    "session_token",
];
const DEFAULT_RETENTION_COUNT = 3;
function safeParseJson(json, fallback) {
    try {
        return JSON.parse(json);
    }
    catch {
        return fallback;
    }
}
export function createRestoreSnapshotStore(database, options = {}) {
    const { sqlite } = database;
    const retentionCount = options.retentionCount ?? DEFAULT_RETENTION_COUNT;
    function trimOldSnapshots() {
        const countResult = sqlite.exec(`SELECT COUNT(*) as cnt FROM restore_snapshot`);
        if (countResult.length === 0 ||
            countResult[0].values.length === 0) {
            return;
        }
        const total = countResult[0].values[0][0] ?? 0;
        if (total <= retentionCount)
            return;
        const toDelete = total - retentionCount;
        sqlite.exec(`DELETE FROM restore_snapshot
       WHERE snapshot_id IN (
         SELECT snapshot_id FROM restore_snapshot
         ORDER BY captured_at ASC
         LIMIT ${toDelete}
       )`);
    }
    return {
        async captureSnapshot(input) {
            const whitelist = input.entityWhitelist && input.entityWhitelist.length > 0
                ? input.entityWhitelist.filter((k) => ALL_RESTORABLE_KINDS.includes(k))
                : [...ALL_RESTORABLE_KINDS];
            const excluded = [...DEFAULT_EXCLUDED_KINDS];
            const capturedAt = input.capturedAt ?? new Date().toISOString();
            sqlite.run(`INSERT INTO restore_snapshot
         (snapshot_id, entity_whitelist_json, excluded_sensitive_kinds_json, captured_at, payload_json)
         VALUES (?, ?, ?, ?, ?)`, [
                input.snapshotId,
                JSON.stringify(whitelist),
                JSON.stringify(excluded),
                capturedAt,
                JSON.stringify(input.payload),
            ]);
            trimOldSnapshots();
            return {
                snapshotId: input.snapshotId,
                entityWhitelist: whitelist,
                excludedSensitiveKinds: [...excluded],
                capturedAt,
                payload: input.payload,
            };
        },
        async loadLatestSnapshot() {
            const result = sqlite.exec(`SELECT * FROM restore_snapshot
         ORDER BY captured_at DESC
         LIMIT 1`);
            if (result.length === 0 || result[0].values.length === 0) {
                return undefined;
            }
            const cols = result[0].columns;
            const get = (row, name) => row[cols.indexOf(name)];
            const row = result[0].values[0];
            return {
                snapshotId: get(row, "snapshot_id"),
                entityWhitelist: safeParseJson(get(row, "entity_whitelist_json") ?? "[]", []),
                excludedSensitiveKinds: safeParseJson(get(row, "excluded_sensitive_kinds_json") ?? "[]", []),
                capturedAt: get(row, "captured_at"),
                payload: safeParseJson(get(row, "payload_json") ?? "{}", {}),
            };
        },
        async listSnapshots(limit = 10) {
            const result = sqlite.exec(`SELECT * FROM restore_snapshot
         ORDER BY captured_at DESC
         LIMIT ${limit}`);
            if (result.length === 0 || result[0].values.length === 0) {
                return [];
            }
            const cols = result[0].columns;
            const get = (row, name) => row[cols.indexOf(name)];
            return result[0].values.map((row) => ({
                snapshotId: get(row, "snapshot_id"),
                entityWhitelist: safeParseJson(get(row, "entity_whitelist_json") ?? "[]", []),
                excludedSensitiveKinds: safeParseJson(get(row, "excluded_sensitive_kinds_json") ?? "[]", []),
                capturedAt: get(row, "captured_at"),
                payload: safeParseJson(get(row, "payload_json") ?? "{}", {}),
            }));
        },
    };
}
