/**
 * HistoryDigestStore — T-SMS.C.7
 *
 * Core logic:
 * - NarrativeTimeline append-only rows (entry_type, subject_id, delta,
 *   previous_hash, current_hash). No row is ever deleted or updated.
 * - HeartbeatDigest daily summary rows (connectorSummary, goalSummary,
 *   quietCount, dreamCount, breakerSummary, healthStatus).
 *
 * Dependencies:
 * - `StateDatabase` from `../db/index.js`
 * - `NarrativeTimelineEntry`, `HeartbeatDigest` from
 *   `../../shared/types/v7-entities.js`
 * - `validateWritePayload` from `./write-validation-gate.js`
 *
 * Boundary:
 * - NarrativeTimeline is strictly append-only; no UPDATE/DELETE path.
 * - HeartbeatDigest writes are day-keyed (UPSERT by day).
 *
 * Test coverage: tests/unit/storage/history-digest-store.test.ts
 */
import { validateWritePayload } from "./write-validation-gate.js";
function safeParseJson(json, fallback) {
    try {
        return JSON.parse(json);
    }
    catch {
        return fallback;
    }
}
export function createHistoryDigestStore(database) {
    const { sqlite } = database;
    return {
        async appendNarrativeTimeline(entry) {
            const gate = validateWritePayload({
                timelineId: entry.timelineId,
                entryType: entry.entryType,
                subjectId: entry.subjectId,
                delta: entry.delta,
                previousHash: entry.previousHash,
                currentHash: entry.currentHash,
                sourceRefs: ["narrative:append"],
            });
            if (!gate.ok)
                throw new Error(gate.reason ?? "write_validation_failed");
            sqlite.run(`INSERT INTO narrative_timeline
         (timeline_id, entry_type, subject_id, delta_json, previous_hash, current_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`, [
                entry.timelineId,
                entry.entryType,
                entry.subjectId,
                JSON.stringify(entry.delta),
                entry.previousHash,
                entry.currentHash,
                entry.createdAt,
            ]);
        },
        async listNarrativeTimeline(query = {}) {
            let sql = `SELECT * FROM narrative_timeline WHERE 1=1`;
            const params = [];
            if (query.subjectId) {
                sql += ` AND subject_id = ?`;
                params.push(query.subjectId);
            }
            sql += ` ORDER BY created_at DESC LIMIT ${query.limit ?? 100}`;
            const result = sqlite.exec(sql, params);
            if (result.length === 0 || result[0].values.length === 0) {
                return [];
            }
            const cols = result[0].columns;
            const get = (row, name) => row[cols.indexOf(name)];
            return result[0].values.map((row) => ({
                timelineId: get(row, "timeline_id"),
                entryType: get(row, "entry_type"),
                subjectId: get(row, "subject_id"),
                delta: safeParseJson(get(row, "delta_json") ?? "{}", {}),
                previousHash: get(row, "previous_hash") ?? "",
                currentHash: get(row, "current_hash") ?? "",
                createdAt: get(row, "created_at"),
            }));
        },
        async writeHeartbeatDigest(digest) {
            const gate = validateWritePayload({
                digestId: digest.digestId,
                day: digest.day,
                connectorSummary: digest.connectorSummary,
                goalSummary: digest.goalSummary,
                quietCount: digest.quietCount,
                dreamCount: digest.dreamCount,
                breakerSummary: digest.breakerSummary,
                healthStatus: digest.healthStatus,
                sourceRefs: ["heartbeat:digest"],
            });
            if (!gate.ok)
                throw new Error(gate.reason ?? "write_validation_failed");
            sqlite.run(`INSERT INTO heartbeat_digest
         (digest_id, day, connector_summary_json, goal_summary_json,
          quiet_count, dream_count, breaker_summary_json, health_status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(day) DO UPDATE SET
           connector_summary_json = excluded.connector_summary_json,
           goal_summary_json = excluded.goal_summary_json,
           quiet_count = excluded.quiet_count,
           dream_count = excluded.dream_count,
           breaker_summary_json = excluded.breaker_summary_json,
           health_status = excluded.health_status,
           created_at = excluded.created_at`, [
                digest.digestId,
                digest.day,
                JSON.stringify(digest.connectorSummary),
                JSON.stringify(digest.goalSummary),
                digest.quietCount,
                digest.dreamCount,
                JSON.stringify(digest.breakerSummary),
                digest.healthStatus,
                digest.createdAt,
            ]);
        },
        async loadHeartbeatDigest(day) {
            const result = sqlite.exec(`SELECT * FROM heartbeat_digest WHERE day = ?`, [day]);
            if (result.length === 0 || result[0].values.length === 0) {
                return undefined;
            }
            const cols = result[0].columns;
            const get = (row, name) => row[cols.indexOf(name)];
            const row = result[0].values[0];
            return {
                digestId: get(row, "digest_id"),
                day: get(row, "day"),
                connectorSummary: safeParseJson(get(row, "connector_summary_json") ?? "[]", []),
                goalSummary: safeParseJson(get(row, "goal_summary_json") ?? "[]", []),
                quietCount: get(row, "quiet_count") ?? 0,
                dreamCount: get(row, "dream_count") ?? 0,
                breakerSummary: safeParseJson(get(row, "breaker_summary_json") ?? "[]", []),
                healthStatus: get(row, "health_status") ?? "ok",
                createdAt: get(row, "created_at"),
            };
        },
    };
}
