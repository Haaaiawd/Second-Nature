import { isLifeEvidenceSliceEmpty } from "../heartbeat/runtime-snapshot.js";
import { writeQuietArtifact } from "../../../storage/quiet/quiet-artifact-writer.js";
import { persistQuietArtifactToWorkspace } from "../../../storage/quiet/persist-quiet-artifact.js";
import { buildEvidencePack, buildQuietNarrativeGuidance, selectInterestBasis } from "../../../guidance/evidence-guidance.js";
import { recordQuietArtifactAudit } from "../../../observability/services/audit-closure-recorders.js";
import { legacyKindFromSourceRef } from "../../../shared/source-ref-compat.js";
function toGuidanceRef(r) {
    return {
        id: r.id,
        kind: legacyKindFromSourceRef(r),
        uri: r.uri,
    };
}
function toLifeEvidenceRef(ref) {
    return {
        id: ref.id,
        kind: ref.kind,
        uri: ref.uri,
        excerptHash: ref.excerptHash,
        observedAt: ref.observedAt,
    };
}
/**
 * v7 T-V7C.C.3: Fire-and-forget Dream schedule after successful Quiet write.
 * Returns the schedule status reason string to embed in HeartbeatCycleResult reasons.
 * Never throws — Dream scheduling failure must not break the Quiet cycle result.
 */
async function maybeScheduleDreamAfterQuiet(dreamSchedulePort, day) {
    if (!dreamSchedulePort)
        return undefined;
    try {
        const result = await dreamSchedulePort.scheduleDream({
            triggerKind: "quiet_completion",
            runId: `dream:quiet_completion:${day}:${Date.now()}`,
            traceId: `trace:quiet_completion:${day}:${Date.now()}`,
        });
        if (result.status === "skipped") {
            return `quiet_dream_skip:${result.reason ?? "lock_held"}`;
        }
        return "quiet_dream_scheduled";
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[run-source-backed-quiet] Dream schedule failed: ${msg}`);
        return `quiet_dream_schedule_error:${msg.slice(0, 60)}`;
    }
}
export async function runSourceBackedQuiet(params) {
    const { candidate, runtime, day, userInterestSnapshot, workspaceRoot, dreamSchedulePort, auditStore } = params;
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
        recordQuietArtifactAudit({
            auditStore,
            day,
            kind: "empty_state",
            status: "empty",
            reasons: ["quiet_empty_state", "no_fictional_narrative"],
            artifactAck: ack,
            persistedRelativePath,
        });
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
    const guidanceRefs = runtime.lifeEvidence.evidenceRefs.map(toGuidanceRef);
    const ep = buildEvidencePack(guidanceRefs);
    if (!ep.ok) {
        recordQuietArtifactAudit({
            auditStore,
            day,
            kind: "daily_report",
            status: "blocked",
            reasons: ep.reasons,
        });
        return {
            result: {
                scope: "rhythm",
                status: "denied",
                selectedIntentId: candidate.id,
                reasons: ep.reasons,
            },
        };
    }
    if (ep.pack.sensitiveBlocked) {
        recordQuietArtifactAudit({
            auditStore,
            day,
            kind: "daily_report",
            status: "blocked",
            reasons: ["quiet_guidance_sensitive_source_blocked"],
        });
        return {
            result: {
                scope: "rhythm",
                status: "denied",
                selectedIntentId: candidate.id,
                reasons: ["quiet_guidance_sensitive_source_blocked"],
            },
        };
    }
    const basis = selectInterestBasis({
        staleness: userInterestSnapshot?.staleness ?? "insufficient",
        confidence: userInterestSnapshot?.confidence ?? 0,
        signalCount: userInterestSnapshot?.signals.length ?? 0,
    });
    const groundedSourceRefs = ep.pack.groundedRefs.map(toLifeEvidenceRef);
    const claims = ep.pack.groundedRefs.map((g, i) => ({
        id: `fact:${g.id}`,
        text: `Evidence-backed note ${i + 1}`,
        claimType: "fact",
        sourceRefs: [
            {
                ...toLifeEvidenceRef(g),
            },
        ],
    }));
    const reportWrite = {
        day,
        kind: "daily_report",
        title: "Quiet daily report",
        body: `Source-backed quiet summary (${groundedSourceRefs.length} refs).`,
        claims,
        sourceRefs: groundedSourceRefs,
    };
    const ack = writeQuietArtifact(reportWrite);
    const gq = buildQuietNarrativeGuidance({
        interestBasis: basis,
        sourceCoverage: ack.sourceCoverage,
        outline: claims.map((c) => c.text),
    });
    if (gq.status === "unavailable") {
        recordQuietArtifactAudit({
            auditStore,
            day,
            kind: "daily_report",
            status: "blocked",
            reasons: gq.reasons,
            artifactAck: ack,
        });
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
    // v7 T-V7C.C.3: After a successful source-backed Quiet write, auto-trigger Dream scheduling.
    const dreamReason = await maybeScheduleDreamAfterQuiet(dreamSchedulePort, day);
    const reasons = ["quiet_artifact_written", ...gq.hints.slice(0, 2)];
    if (dreamReason)
        reasons.push(dreamReason);
    recordQuietArtifactAudit({
        auditStore,
        day,
        kind: "daily_report",
        status: "completed",
        reasons,
        artifactAck: ack,
        persistedRelativePath,
    });
    return {
        result: {
            scope: "rhythm",
            status: "intent_selected",
            selectedIntentId: candidate.id,
            reasons,
        },
        artifactAck: ack,
        persistedRelativePath,
    };
}
