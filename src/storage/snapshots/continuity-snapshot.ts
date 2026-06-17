/**
 * Continuity snapshot read model (T4.2.1) — lightweight bridge until full state feeds land.
 */
import * as crypto from "node:crypto";
import { desc } from "drizzle-orm";

import type { ObservabilityDatabase } from "../../observability/db/index.js";
import { decisionLedger } from "../../observability/db/schema/index.js";
import type { StateDatabase } from "../db/index.js";
import { repairStateIndexes } from "../bootstrap/repair-gate.js";
import type { LifeEvidenceSourceRef } from "../life-evidence/types.js";

import { loadLifeEvidenceSnapshot } from "./life-evidence-snapshot.js";
import type { ContinuitySnapshot } from "./types.js";

export interface LoadContinuitySnapshotParams {
  state: StateDatabase;
  workspaceRoot: string;
  observability?: ObservabilityDatabase;
}

export async function loadContinuitySnapshot(params: LoadContinuitySnapshotParams): Promise<ContinuitySnapshot> {
  await repairStateIndexes(params.state, { startupGate: true, workspaceRoot: params.workspaceRoot });

  const life = await loadLifeEvidenceSnapshot(
    params.state,
    params.workspaceRoot,
    { limit: 50 },
    { runRepairGate: false }
  );

  let recentDecisionRefs: LifeEvidenceSourceRef[] = [];
  if (params.observability) {
    const rows = await params.observability.db
      .select()
      .from(decisionLedger)
      .orderBy(desc(decisionLedger.createdAt))
      .limit(5);
    recentDecisionRefs = rows.map((r) => ({
      id: r.id,
      kind: "decision_record" as const,
      uri: `sn://decision/${r.id}`,
    }));
  }

  const pendingCount = life.platformEvents.length + life.workEvents.length + life.userInteractionEvents.length;
  const oldest = [...life.platformEvents, ...life.workEvents, ...life.userInteractionEvents]
    .map((e) => e.timestamp)
    .sort()[0];

  return {
    snapshotId: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
    recentDecisionRefs,
    openObligations: [],
    quietDebt: {
      hasUnprocessedEvidence: !life.empty,
      oldestUnprocessedEvidenceAt: oldest,
      pendingCount,
    },
    fallbackRefs: [],
  };
}
