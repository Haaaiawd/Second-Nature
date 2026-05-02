/**
 * Bounded life evidence snapshot read model (T4.2.1).
 */
import * as crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { and, desc, gte, inArray, lte } from "drizzle-orm";
import { lifeEvidenceIndex } from "../db/schema/life-evidence-index.js";
import { repairStateIndexes } from "../bootstrap/repair-gate.js";
function toReadModel(stored) {
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
function buildCoverage(events) {
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
export async function loadLifeEvidenceSnapshot(state, workspaceRoot, query, options) {
    const runGate = options?.runRepairGate !== false;
    if (runGate) {
        const repair = await repairStateIndexes(state, { startupGate: true, workspaceRoot });
        if (repair.status === "repair_required") {
            const err = new Error("state_repair_required");
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
    const platformEvents = [];
    const workEvents = [];
    const userInteractionEvents = [];
    const quietArtifacts = [];
    const evidenceRefs = [];
    for (const row of rows) {
        const abs = path.join(workspaceRoot, row.artifactPath.replace(/\//g, path.sep));
        if (!fs.existsSync(abs)) {
            continue;
        }
        const stored = JSON.parse(fs.readFileSync(abs, "utf-8"));
        const model = toReadModel(stored);
        evidenceRefs.push({
            id: `ref:${model.id}`,
            kind: "workspace_artifact",
            uri: row.artifactPath,
        });
        if (model.evidenceType === "platform_browse" || model.evidenceType === "platform_interaction") {
            platformEvents.push(model);
        }
        else if (model.evidenceType === "work_progress" || model.evidenceType === "task_discovery") {
            workEvents.push(model);
        }
        else if (model.evidenceType === "user_interaction") {
            userInteractionEvents.push(model);
        }
        else if (model.evidenceType === "quiet_reflection") {
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
