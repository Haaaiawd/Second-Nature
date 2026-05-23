/**
 * DailyDiaryWriter — T-DQS.C.1
 *
 * Core logic: Convert QuietClaims into a three-section DailyDiary artifact.
 * - observedToday: from observation claims (what was seen)
 * - notableSignals: from fact claims (what matters)
 * - tomorrowDirection: from pattern claims or best-guess from facts
 *
 * Rules:
 * - Each section gets at most 5 entries (bounded, non-bloat)
 * - Empty claims → empty sections (no fabricated content)
 * - sourceRefs aggregated from all contributing claims
 * - sensitive refs filtered by WriteValidationGate upstream (not here)
 *
 * Dependencies:
 * - `DailyDiary` from `../../../shared/types/v7-entities.js`
 * - `QuietClaim` from `../../../shared/types/v7-entities.js`
 *
 * Test coverage: tests/unit/quiet/daily-diary-writer.test.ts
 */
import type { DailyDiary, QuietClaim } from "../../../shared/types/v7-entities.js";
export interface DailyDiaryResult {
    diary: DailyDiary;
    errors: string[];
}
export interface DailyDiaryWriter {
    write(claims: QuietClaim[], day: string): DailyDiaryResult;
}
export declare function createDailyDiaryWriter(): DailyDiaryWriter;
