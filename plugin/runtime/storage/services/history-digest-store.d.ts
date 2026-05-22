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
import type { StateDatabase } from "../db/index.js";
import type { NarrativeTimelineEntry, HeartbeatDigest } from "../../shared/types/v7-entities.js";
export interface HistoryDigestStore {
    appendNarrativeTimeline(entry: NarrativeTimelineEntry): Promise<void>;
    listNarrativeTimeline(query?: {
        subjectId?: string;
        limit?: number;
    }): Promise<NarrativeTimelineEntry[]>;
    writeHeartbeatDigest(digest: HeartbeatDigest): Promise<void>;
    loadHeartbeatDigest(day: string): Promise<HeartbeatDigest | undefined>;
}
export declare function createHistoryDigestStore(database: StateDatabase): HistoryDigestStore;
