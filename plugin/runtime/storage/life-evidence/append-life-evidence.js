/**
 * Append canonical LifeEvidence artifacts and SQLite index rows (state-system T4.1.1).
 *
 * Core logic: reject missing source refs and credential sensitivity; write JSON artifact;
 * insert life_evidence_index; bump snapshot epoch file for downstream snapshot invalidation.
 *
 * Dependencies: StateDatabase drizzle + optional ProvenanceRepository for source edges.
 *
 * Boundaries: does not run connector normalization; caller supplies validated candidates.
 *
 * Test coverage: tests/unit/storage/life-evidence.test.ts
 */
import * as crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { lifeEvidenceIndex } from "../db/schema/life-evidence-index.js";
export async function appendLifeEvidence(state, workspaceRoot, candidate, options) {
    if (!candidate.sourceRefs || candidate.sourceRefs.length === 0) {
        throw new Error("life_evidence_missing_source_refs");
    }
    if (candidate.sensitivity === "credential") {
        throw new Error("life_evidence_credential_rejected");
    }
    const evidenceId = candidate.id ?? `lev_${crypto.randomUUID()}`;
    const artifactRel = path.join(".second-nature", "evidence", `${evidenceId}.json`);
    const artifactAbs = path.join(workspaceRoot, artifactRel);
    const artifactRef = {
        id: `artifact:${evidenceId}`,
        kind: "workspace_artifact",
        uri: artifactRel.replace(/\\/g, "/"),
    };
    const life = {
        id: evidenceId,
        timestamp: candidate.timestamp,
        evidenceType: candidate.evidenceType,
        platformId: candidate.platformId,
        summary: candidate.summary,
        rawContentRef: candidate.rawContentRef,
        sourceRefs: candidate.sourceRefs,
        sensitivity: candidate.sensitivity,
        confidence: candidate.confidence ?? 1,
        tags: candidate.tags ?? [],
        producer: candidate.producer,
        artifactRef,
    };
    fs.mkdirSync(path.dirname(artifactAbs), { recursive: true });
    fs.writeFileSync(artifactAbs, JSON.stringify(life, null, 2), "utf-8");
    const epochPath = path.join(workspaceRoot, ".second-nature", "evidence", ".snapshot_epoch");
    fs.writeFileSync(epochPath, `${Date.now()}\n`, "utf-8");
    await state.db.insert(lifeEvidenceIndex).values({
        id: evidenceId,
        timestamp: candidate.timestamp,
        evidenceType: candidate.evidenceType,
        sensitivity: candidate.sensitivity,
        producer: candidate.producer,
        artifactPath: artifactRel.replace(/\\/g, "/"),
        platformId: candidate.platformId ?? null,
        sourceRefsJson: JSON.stringify(candidate.sourceRefs),
    });
    if (options?.provenance) {
        await options.provenance.linkEntrySources(evidenceId, candidate.sourceRefs.map((ref) => ref.id));
    }
    return { evidenceId, artifactRef };
}
