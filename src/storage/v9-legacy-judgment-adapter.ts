/**
 * v8 JudgmentVerdict → v9 AttentionSignal legacy adapter.
 *
 * Core logic: Read a v8 `judgment_verdict` row and return a degraded
 * `AttentionSignal` for observability replay / historical queries only.
 * The mapped signal must NOT enter the v9 real-time action cycle.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/memory-continuity-system.detail.md §3.1a`
 * - `.anws/v9/04_SYSTEM_DESIGN/attention-system.detail.md §2.2`
 * - `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md §3`
 *
 * Dependencies:
 * - `src/storage/db/schema/v8-entities.js` (judgmentVerdict)
 * - `src/shared/types/v9-contracts.js` (AttentionSignal, SourceRef)
 *
 * Test coverage: tests/unit/memory/v9-legacy-judgment-adapter.test.ts
 */

import { eq } from "drizzle-orm";
import type { StateDatabase } from "./db/index.js";
import { judgmentVerdict } from "./db/schema/v8-entities.js";
import type { AttentionSignal } from "../shared/types/v9-contracts.js";

export interface LegacyJudgmentAdapterResult {
  kind: "mapped" | "not_found";
  signal?: AttentionSignal;
}

export async function readLegacyJudgmentVerdictAsAttentionSignal(
  db: StateDatabase,
  judgmentId: string,
): Promise<LegacyJudgmentAdapterResult> {
  const rows = await db.db.select().from(judgmentVerdict).where(eq(judgmentVerdict.id, judgmentId));
  const row = rows[0];
  if (!row) {
    return { kind: "not_found" };
  }

  const signal: AttentionSignal = {
    signalId: row.id,
    novelty: 0,
    relevance: 0,
    repetition: "identity_unstable",
    risk: mapRiskPosture(row.riskPosture),
    possibleActions: [],
    sourceRefs: [
      {
        family: "attention",
        id: row.id,
        label: "v8_legacy_judgment",
      },
    ],
    summary: "v8 legacy judgment mapped to attention signal (replay only)",
    status: "degraded",
    reason: "v8_legacy_judgment_mapped",
  };

  return {
    kind: "mapped",
    signal,
  };
}

function mapRiskPosture(riskPosture: string | null | undefined): AttentionSignal["risk"] {
  if (!riskPosture) return "none";
  const normalized = riskPosture.toLowerCase();
  switch (normalized) {
    case "high":
      return "high";
    case "medium":
      return "medium";
    case "low":
      return "low";
    default:
      return "none";
  }
}
