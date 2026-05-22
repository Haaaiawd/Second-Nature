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
import type { StateDatabase } from "../db/index.js";
import type { DailyDiary, DreamOutput, DreamOutputStatus } from "../../shared/types/v7-entities.js";
export interface DiaryDreamStore {
    writeDailyDiary(diary: DailyDiary): Promise<void>;
    loadDailyDiary(day: string): Promise<DailyDiary | undefined>;
    appendDreamOutput(output: DreamOutput): Promise<void>;
    transitionDreamOutputLifecycle(outputId: string, newStatus: Exclude<DreamOutputStatus, "candidate" | "partial">): Promise<void>;
    loadAcceptedDreamProjection(limit?: number): Promise<DreamOutput[]>;
    listDreamOutputs(limit?: number): Promise<DreamOutput[]>;
}
export declare function createDiaryDreamStore(database: StateDatabase): DiaryDreamStore;
