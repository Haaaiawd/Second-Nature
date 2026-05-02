import { isLifeEvidenceSliceEmpty } from "../heartbeat/runtime-snapshot.js";
import { writeQuietArtifact } from "../../../storage/quiet/quiet-artifact-writer.js";
import { persistQuietArtifactToWorkspace } from "../../../storage/quiet/persist-quiet-artifact.js";
import { buildEvidencePack, buildQuietNarrativeGuidance, selectInterestBasis } from "../../../guidance/evidence-guidance.js";
function toSourceRefFromControlPlane(r) {
    return {
        id: r.id,
        kind: r.kind,
        uri: r.uri,
        excerptHash: r.excerptHash,
        observedAt: r.observedAt,
    };
}
function toGuidanceRef(r) {
    return {
        id: r.id,
        kind: r.kind,
        uri: r.uri,
        excerptHash: r.excerptHash,
        observedAt: r.observedAt,
    };
}
export async function runSourceBackedQuiet(params) {
    const { candidate, runtime, day, userInterestSnapshot, workspaceRoot } = params;
    const empty = isLifeEvidenceSliceEmpty(runtime.lifeEvidence);
    if (empty) {
        const input = {
            day,
            kind: "empty_state",
            title: "Quiet — no life evidence",
            body: "No source-backed life evidence in window; narrative reflection is skipped.",
            claims: [],
            sourceRefs: [],
        };
        const ack = writeQuietArtifact(input);
        let persistedRelativePath;
        if (workspaceRoot) {
            const p = await persistQuietArtifactToWorkspace(workspaceRoot, ack, input);
            persistedRelativePath = p.relativePath;
        }
        return {
            result: {
                scope: "rhythm",
                status: "intent_selected",
                selectedIntentId: candidate.id,
                reasons: ["quiet_empty_state", "no_fictional_narrative"],
            },
            artifactAck: ack,
            persistedRelativePath,
        };
    }
    const bundleRefs = runtime.lifeEvidence.evidenceRefs.map(toSourceRefFromControlPlane);
    const guidanceRefs = runtime.lifeEvidence.evidenceRefs.map(toGuidanceRef);
    const ep = buildEvidencePack(guidanceRefs);
    if (!ep.ok) {
        return {
            result: {
                scope: "rhythm",
                status: "denied",
                selectedIntentId: candidate.id,
                reasons: ep.reasons,
            },
        };
    }
    const basis = selectInterestBasis({
        staleness: userInterestSnapshot?.staleness ?? "insufficient",
        confidence: userInterestSnapshot?.confidence ?? 0,
        signalCount: userInterestSnapshot?.signals.length ?? 0,
    });
    const claims = ep.pack.groundedRefs.map((g, i) => ({
        id: `fact:${g.id}`,
        text: `Evidence-backed note ${i + 1}`,
        claimType: "fact",
        sourceRefs: [
            {
                id: g.id,
                kind: g.kind,
                uri: g.uri,
                excerptHash: g.excerptHash,
                observedAt: g.observedAt,
            },
        ],
    }));
    const reportWrite = {
        day,
        kind: "daily_report",
        title: "Quiet daily report",
        body: `Source-backed quiet summary (${bundleRefs.length} refs).`,
        claims,
        sourceRefs: bundleRefs,
    };
    const ack = writeQuietArtifact(reportWrite);
    const gq = buildQuietNarrativeGuidance({
        interestBasis: basis,
        sourceCoverage: ack.sourceCoverage,
        outline: claims.map((c) => c.text),
    });
    if (gq.status === "unavailable") {
        return {
            result: {
                scope: "rhythm",
                status: "denied",
                selectedIntentId: candidate.id,
                reasons: gq.reasons,
            },
        };
    }
    let persistedRelativePath;
    if (workspaceRoot) {
        const p = await persistQuietArtifactToWorkspace(workspaceRoot, ack, reportWrite);
        persistedRelativePath = p.relativePath;
    }
    return {
        result: {
            scope: "rhythm",
            status: "intent_selected",
            selectedIntentId: candidate.id,
            reasons: ["quiet_artifact_written", ...gq.hints.slice(0, 2)],
        },
        artifactAck: ack,
        persistedRelativePath,
    };
}
