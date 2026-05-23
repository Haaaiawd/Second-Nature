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

import type {
  DailyDiary,
  QuietClaim,
} from "../../../shared/types/v7-entities.js";

export interface DailyDiaryResult {
  diary: DailyDiary;
  errors: string[];
}

export interface DailyDiaryWriter {
  write(claims: QuietClaim[], day: string): DailyDiaryResult;
}

const SECTION_LIMIT = 5;

function pickObservations(claims: QuietClaim[]): string[] {
  return claims
    .filter((c) => c.kind === "observation")
    .map((c) => c.text)
    .slice(0, SECTION_LIMIT);
}

function pickNotableSignals(claims: QuietClaim[]): string[] {
  return claims
    .filter((c) => c.kind === "fact")
    .map((c) => c.text)
    .slice(0, SECTION_LIMIT);
}

function pickTomorrowDirection(claims: QuietClaim[]): string {
  const patterns = claims.filter((c) => c.kind === "pattern");
  if (patterns.length > 0) {
    return `Continue watching: ${patterns
      .map((p) => p.text)
      .join("; ")
      .slice(0, 200)}`;
  }

  const facts = claims.filter((c) => c.kind === "fact");
  if (facts.length > 0) {
    return `Follow up on ${facts.length} note(s) tomorrow.`;
  }

  const observations = claims.filter((c) => c.kind === "observation");
  if (observations.length > 0) {
    return `Keep observing; no strong signals yet.`;
  }

  return "Nothing significant today.";
}

function aggregateSourceRefs(claims: QuietClaim[]): [string, ...string[]] {
  const seen = new Set<string>();
  for (const claim of claims) {
    for (const ref of claim.sourceRefs) {
      if (!ref.startsWith("synthetic://")) {
        seen.add(ref);
      }
    }
  }
  const arr = [...seen];
  if (arr.length === 0) {
    return ["synthetic://empty"];
  }
  return arr as [string, ...string[]];
}

export function createDailyDiaryWriter(): DailyDiaryWriter {
  return {
    write(claims, day) {
      const errors: string[] = [];
      const now = new Date().toISOString();

      const observedToday = pickObservations(claims);
      const notableSignals = pickNotableSignals(claims);
      const tomorrowDirection = pickTomorrowDirection(claims);

      if (
        observedToday.length === 0 &&
        notableSignals.length === 0 &&
        tomorrowDirection === "Nothing significant today."
      ) {
        errors.push("diary_empty:no_claims");
      }

      const diary: DailyDiary = {
        diaryId: `diary:${day}:${Date.now()}`,
        day,
        observedToday,
        notableSignals,
        tomorrowDirection,
        sourceRefs: aggregateSourceRefs(claims),
        createdAt: now,
      };

      return { diary, errors };
    },
  };
}
