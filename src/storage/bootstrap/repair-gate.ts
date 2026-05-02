/**
 * Startup repair gate for state indexes (T4.1.3) — reconciles life evidence filesystem vs SQLite index.
 *
 * Core logic: scan `.second-nature/evidence/*.json`; on startupGate, corrupt JSON fails closed with repair_required;
 * otherwise backfill missing `life_evidence_index` rows from parsed artifacts.
 *
 * Test coverage: tests/unit/storage/repair-gate.test.ts
 */
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";

import type { StateDatabase } from "../db/index.js";
import { lifeEvidenceIndex } from "../db/schema/life-evidence-index.js";
import type { LifeEvidence } from "../life-evidence/types.js";
import {
  createRepairAndBackupService,
  type RepairAndBackupOptions,
} from "../services/repair-and-backup.js";

export interface RepairStateIndexesOptions {
  startupGate?: boolean;
  workspaceRoot: string;
  /** When true, also runs asset registry repair + backup (existing repair service) */
  reconcileAssets?: boolean;
  assetRepairOptions?: RepairAndBackupOptions;
}

export type RepairGateStatus = "ok" | "repair_required";

export interface RepairSummary {
  status: RepairGateStatus;
  repairedEvidenceIndexRows: number;
  repairNotes: string[];
  assetRepair?: Awaited<ReturnType<ReturnType<typeof createRepairAndBackupService>["runStartupRepair"]>>;
}

export async function repairStateIndexes(
  state: StateDatabase,
  options: RepairStateIndexesOptions
): Promise<RepairSummary> {
  const notes: string[] = [];
  let repaired = 0;
  const evidenceDir = path.join(options.workspaceRoot, ".second-nature", "evidence");

  if (!fs.existsSync(evidenceDir)) {
    notes.push("no_evidence_dir");
  } else {
    const entries = fs.readdirSync(evidenceDir);
    for (const name of entries) {
      if (!name.endsWith(".json") || name.startsWith(".")) {
        continue;
      }
      const abs = path.join(evidenceDir, name);
      let parsed: LifeEvidence;
      try {
        parsed = JSON.parse(fs.readFileSync(abs, "utf-8")) as LifeEvidence;
      } catch {
        if (options.startupGate) {
          return {
            status: "repair_required",
            repairedEvidenceIndexRows: repaired,
            repairNotes: [...notes, `corrupt_evidence_json:${name}`],
          };
        }
        notes.push(`skip_corrupt:${name}`);
        continue;
      }

      const existing = await state.db.select().from(lifeEvidenceIndex).where(eq(lifeEvidenceIndex.id, parsed.id)).limit(1);
      if (existing.length === 0) {
        await state.db.insert(lifeEvidenceIndex).values({
          id: parsed.id,
          timestamp: parsed.timestamp,
          evidenceType: parsed.evidenceType,
          sensitivity: parsed.sensitivity,
          producer: parsed.producer,
          artifactPath: path.join(".second-nature", "evidence", `${parsed.id}.json`).replace(/\\/g, "/"),
          platformId: parsed.platformId ?? null,
          sourceRefsJson: JSON.stringify(parsed.sourceRefs),
        });
        repaired += 1;
        notes.push(`reindexed:${parsed.id}`);
      }
    }
  }

  let assetRepair: RepairSummary["assetRepair"];
  if (options.reconcileAssets) {
    const svc = createRepairAndBackupService(state);
    assetRepair = await svc.runStartupRepair(options.assetRepairOptions ?? {});
  }

  return {
    status: "ok",
    repairedEvidenceIndexRows: repaired,
    repairNotes: notes,
    assetRepair,
  };
}
