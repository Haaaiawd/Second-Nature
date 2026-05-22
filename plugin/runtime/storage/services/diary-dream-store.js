/**
 * DiaryDreamStore — T-SMS.C.7
 *
 * Core logic:
 * - DailyDiary artifact ref + index (observedToday, notableSignals,
 *   tomorrowDirection, sourceRefs)
 * - DreamOutput lifecycle: candidate -> accepted -> archived
 *   (partial is a terminal state, not a lifecycle stage)
 * - `transitionDreamOutputLifecycle` enforces VALID_TRANSITIONS.
 * - Read path `loadAcceptedDreamProjection` only exposes accepted outputs.
 *
 * Dependencies:
 * - `StateDatabase` from `../db/index.js`
 * - `DailyDiary`, `DreamOutput`, `DreamOutputStatus` from
 *   `../../shared/types/v7-entities.js`
 * - `validateWritePayload` from `./write-validation-gate.js`
 *
 * Boundary:
 * - Candidate outputs are stored but filtered from active read paths.
 * - Accepted transition is initiated by dream-quiet (DR-023).
 * - Write paths pass through WriteValidationGate.
 *
 * Test coverage: tests/unit/storage/diary-dream-store.test.ts
 */
import { validateWritePayload } from "./write-validation-gate.js";
const VALID_TRANSITIONS = {
    candidate: ["accepted", "archived"],
    accepted: ["archived"],
    archived: [],
    partial: [],
};
function safeParseJson(json, fallback) {
    try {
        return JSON.parse(json);
    }
    catch {
        return fallback;
    }
}
export function createDiaryDreamStore(database) {
    const { sqlite } = database;
    return {
        async writeDailyDiary(diary) {
            const gate = validateWritePayload({
                ...diary,
                sourceRefs: diary.sourceRefs,
            });
            if (!gate.ok)
                throw new Error(gate.reason ?? "write_validation_failed");
            sqlite.run(`INSERT INTO daily_diary_index
         (diary_id, day, observed_today_json, notable_signals_json, tomorrow_direction, source_refs_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(day) DO UPDATE SET
           observed_today_json = excluded.observed_today_json,
           notable_signals_json = excluded.notable_signals_json,
           tomorrow_direction = excluded.tomorrow_direction,
           source_refs_json = excluded.source_refs_json,
           created_at = excluded.created_at`, [
                diary.diaryId,
                diary.day,
                JSON.stringify(diary.observedToday),
                JSON.stringify(diary.notableSignals),
                diary.tomorrowDirection,
                JSON.stringify(diary.sourceRefs),
                diary.createdAt,
            ]);
        },
        async loadDailyDiary(day) {
            const result = sqlite.exec(`SELECT * FROM daily_diary_index WHERE day = ?`, [day]);
            if (result.length === 0 || result[0].values.length === 0) {
                return undefined;
            }
            const cols = result[0].columns;
            const get = (row, name) => row[cols.indexOf(name)];
            const row = result[0].values[0];
            return {
                diaryId: get(row, "diary_id"),
                day: get(row, "day"),
                observedToday: safeParseJson(get(row, "observed_today_json") ?? "[]", []),
                notableSignals: safeParseJson(get(row, "notable_signals_json") ?? "[]", []),
                tomorrowDirection: get(row, "tomorrow_direction") ?? "",
                sourceRefs: safeParseJson(get(row, "source_refs_json") ?? "[]", ["store:default"]),
                createdAt: get(row, "created_at"),
            };
        },
        async appendDreamOutput(output) {
            const gate = validateWritePayload({
                ...output,
                sourceRefs: ["dream:run"],
            });
            if (!gate.ok)
                throw new Error(gate.reason ?? "write_validation_failed");
            sqlite.run(`INSERT INTO dream_output_index
         (output_id, run_id, status, canonical_entries_json, insights_json,
          narrative_update_json, relationship_update_json, validation_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                output.outputId,
                output.runId,
                output.status,
                JSON.stringify(output.canonicalEntries),
                JSON.stringify(output.insights),
                output.narrativeUpdate ? JSON.stringify(output.narrativeUpdate) : null,
                output.relationshipUpdate ? JSON.stringify(output.relationshipUpdate) : null,
                JSON.stringify(output.validation),
                output.createdAt ?? new Date().toISOString(),
            ]);
        },
        async transitionDreamOutputLifecycle(outputId, newStatus) {
            const currentResult = sqlite.exec(`SELECT status FROM dream_output_index WHERE output_id = ?`, [outputId]);
            if (currentResult.length === 0 ||
                currentResult[0].values.length === 0) {
                throw new Error(`dream_output_not_found:${outputId}`);
            }
            const currentStatus = currentResult[0].values[0][0];
            const allowed = VALID_TRANSITIONS[currentStatus];
            if (!allowed.includes(newStatus)) {
                throw new Error(`invalid_transition:${currentStatus}->${newStatus}`);
            }
            sqlite.run(`UPDATE dream_output_index SET status = ? WHERE output_id = ?`, [newStatus, outputId]);
        },
        async loadAcceptedDreamProjection(limit = 10) {
            const result = sqlite.exec(`SELECT * FROM dream_output_index
         WHERE status = 'accepted'
         ORDER BY created_at DESC
         LIMIT ${limit}`);
            if (result.length === 0 || result[0].values.length === 0) {
                return [];
            }
            const cols = result[0].columns;
            const get = (row, name) => row[cols.indexOf(name)];
            return result[0].values.map((row) => rowToDreamOutput(row, cols));
        },
        async listDreamOutputs(limit = 10) {
            const result = sqlite.exec(`SELECT * FROM dream_output_index
         ORDER BY created_at DESC
         LIMIT ${limit}`);
            if (result.length === 0 || result[0].values.length === 0) {
                return [];
            }
            const cols = result[0].columns;
            return result[0].values.map((row) => rowToDreamOutput(row, cols));
        },
    };
}
function rowToDreamOutput(row, cols) {
    const get = (name) => row[cols.indexOf(name)];
    return {
        outputId: get("output_id"),
        runId: get("run_id"),
        status: get("status"),
        canonicalEntries: safeParseJson(get("canonical_entries_json") ?? "[]", []),
        insights: safeParseJson(get("insights_json") ?? "[]", []),
        narrativeUpdate: safeParseJson(get("narrative_update_json") ?? "null", undefined),
        relationshipUpdate: safeParseJson(get("relationship_update_json") ?? "null", undefined),
        validation: safeParseJson(get("validation_json") ?? "{}", {
            schemaValid: false,
            sourceGrounded: false,
            sensitivityClean: false,
            unsupportedClaims: [],
            errors: [],
            checkedAt: new Date().toISOString(),
        }),
        createdAt: get("created_at") ?? new Date().toISOString(),
    };
}
