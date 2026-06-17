/**
 * Bounded life evidence snapshot read model (T4.2.1).
 */
import * as crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { and, desc, gte, inArray, lte } from "drizzle-orm";

import type { StateDatabase } from "../db/index.js";
import { lifeEvidenceIndex } from "../db/schema/life-evidence-index.js";
import type { LifeEvidence, LifeEvidenceSourceRef } from "../life-evidence/types.js";
import { repairStateIndexes } from "../bootstrap/repair-gate.js";

import type { LifeEvidenceQuery, LifeEvidenceReadModel, LifeEvidenceSnapshot, SourceCoverage } from "./types.js";

function toReadModel(stored: LifeEvidence): LifeEvidenceReadModel {
  return {
    id: stored.id,
    timestamp: stored.timestamp,
    evidenceType: stored.evidenceType,
    platformId: stored.platformId,
    summary: stored.summary,
    rawContentRef: stored.rawContentRef,
    sourceRefs: stored.sourceRefs,
    sensitivity: stored.sensitivity,
    confidence: stored.confidence,
    tags: stored.tags,
    producer: stored.producer,
  };
}

function buildCoverage(events: LifeEvidenceReadModel[]): SourceCoverage {
  if (events.length === 0) {
    return { coverageRatio: 1, unsupportedClaims: [], claimCoverage: [] };
  }
  const backed = events.filter((e) => e.sourceRefs.length > 0).length;
  return {
    coverageRatio: backed / events.length,
    unsupportedClaims: [],
    claimCoverage: events.map((e, i) => ({
      claimId: `ev:${e.id}:${i}`,
      backed: e.sourceRefs.length > 0,
      sourceRefs: e.sourceRefs,
    })),
  };
}

export interface LoadLifeEvidenceSnapshotOptions {
  runRepairGate?: boolean;
}

export async function loadLifeEvidenceSnapshot(
  state: StateDatabase,
  workspaceRoot: string,
  query: LifeEvidenceQuery,
  options?: LoadLifeEvidenceSnapshotOptions
): Promise<LifeEvidenceSnapshot> {
  const runGate = options?.runRepairGate !== false;
  if (runGate) {
    const repair = await repairStateIndexes(state, { startupGate: true, workspaceRoot });
    if (repair.status === "repair_required") {
      const err = new Error("state_repair_required") as Error & { code: string };
      err.code = "repair_required";
      throw err;
    }
  }

  const now = new Date().toISOString();
  const windowEnd = query.windowEnd ?? now;
  const windowStart = query.windowStart ?? new Date(Date.now() - 7 * 86400000).toISOString();
  const limit = query.limit ?? 50;

  const conditions = [gte(lifeEvidenceIndex.timestamp, windowStart), lte(lifeEvidenceIndex.timestamp, windowEnd)];
  if (query.evidenceTypes?.length) {
    conditions.push(inArray(lifeEvidenceIndex.evidenceType, query.evidenceTypes));
  }

  const rows = await state.db
    .select()
    .from(lifeEvidenceIndex)
    .where(and(...conditions))
    .orderBy(desc(lifeEvidenceIndex.timestamp))
    .limit(limit);

  const platformEvents: LifeEvidenceReadModel[] = [];
  const workEvents: LifeEvidenceReadModel[] = [];
  const userInteractionEvents: LifeEvidenceReadModel[] = [];
  const quietArtifacts: LifeEvidenceSourceRef[] = [];
  const evidenceRefs: LifeEvidenceSourceRef[] = [];

  for (const row of rows) {
    const abs = path.join(workspaceRoot, row.artifactPath.replace(/\//g, path.sep));
    if (!fs.existsSync(abs)) {
      continue;
    }
    const stored = JSON.parse(fs.readFileSync(abs, "utf-8")) as LifeEvidence;
    const model = toReadModel(stored);
    evidenceRefs.push({
      id: `ref:${model.id}`,
      kind: "workspace_artifact",
      uri: row.artifactPath,
    });
    if (model.evidenceType === "platform_browse" || model.evidenceType === "platform_interaction") {
      platformEvents.push(model);
    } else if (model.evidenceType === "work_progress" || model.evidenceType === "task_discovery") {
      workEvents.push(model);
    } else if (model.evidenceType === "user_interaction") {
      userInteractionEvents.push(model);
    } else if (model.evidenceType === "quiet_reflection") {
      quietArtifacts.push({
        id: `quiet:${model.id}`,
        kind: "workspace_artifact",
        uri: row.artifactPath,
      });
    }
  }

  const all = [...platformEvents, ...workEvents, ...userInteractionEvents];
  const coverage = buildCoverage(all);
  const empty = all.length === 0;

  return {
    snapshotId: crypto.randomUUID(),
    generatedAt: now,
    windowStart,
    windowEnd,
    evidenceRefs,
    platformEvents,
    workEvents,
    userInteractionEvents,
    quietArtifacts,
    coverage,
    empty,
  };
}
