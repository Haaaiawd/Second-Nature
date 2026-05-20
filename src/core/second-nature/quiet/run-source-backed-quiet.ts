/**
 * Quiet / reflection orchestration: empty evidence → empty_state; otherwise coverage-gated artifact (T2.3.3).
 */
import type { CandidateIntent } from "../types.js";
import type { HeartbeatRuntimeSnapshot } from "../heartbeat/runtime-snapshot.js";
import { isLifeEvidenceSliceEmpty } from "../heartbeat/runtime-snapshot.js";
import type { HeartbeatCycleResult } from "../heartbeat/signal.js";
import type { SourceRef } from "../../../storage/life-evidence/types.js";
import { writeQuietArtifact, type QuietArtifactAck } from "../../../storage/quiet/quiet-artifact-writer.js";
import type { QuietArtifactWrite, QuietClaim } from "../../../storage/quiet/quiet-artifact-types.js";
import { persistQuietArtifactToWorkspace } from "../../../storage/quiet/persist-quiet-artifact.js";
import type { GuidanceSourceRef } from "../../../guidance/outreach-draft-schema.js";
import { buildEvidencePack, buildQuietNarrativeGuidance, selectInterestBasis } from "../../../guidance/evidence-guidance.js";
import type { UserInterestSnapshot } from "../../../storage/user-interest/types.js";

function toGuidanceRef(r: CandidateIntent["sourceRefs"][number]): GuidanceSourceRef {
  return {
    id: r.id,
    kind: r.kind as GuidanceSourceRef["kind"],
    uri: r.uri,
    excerptHash: r.excerptHash,
    observedAt: r.observedAt,
  };
}

export interface RunSourceBackedQuietParams {
  candidate: CandidateIntent;
  runtime: HeartbeatRuntimeSnapshot;
  day: string;
  userInterestSnapshot?: UserInterestSnapshot;
  workspaceRoot?: string;
}

export interface RunSourceBackedQuietResult {
  result: HeartbeatCycleResult;
  artifactAck?: QuietArtifactAck;
  persistedRelativePath?: string;
}

export async function runSourceBackedQuiet(params: RunSourceBackedQuietParams): Promise<RunSourceBackedQuietResult> {
  const { candidate, runtime, day, userInterestSnapshot, workspaceRoot } = params;
  const empty = isLifeEvidenceSliceEmpty(runtime.lifeEvidence);

  if (empty) {
    const input: QuietArtifactWrite = {
      day,
      kind: "empty_state",
      title: "Quiet — no life evidence",
      body: "No source-backed life evidence in window; narrative reflection is skipped.",
      claims: [],
      sourceRefs: [],
    };
    const ack = writeQuietArtifact(input);
    let persistedRelativePath: string | undefined;
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
  if (ep.pack.sensitiveBlocked) {
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

  const groundedSourceRefs = ep.pack.groundedRefs.map((g): SourceRef => ({
    id: g.id,
    kind: g.kind as SourceRef["kind"],
    uri: g.uri,
    excerptHash: g.excerptHash,
    observedAt: g.observedAt,
  }));

  const claims: QuietClaim[] = ep.pack.groundedRefs.map((g, i) => ({
    id: `fact:${g.id}`,
    text: `Evidence-backed note ${i + 1}`,
    claimType: "fact",
    sourceRefs: [
      {
        id: g.id,
        kind: g.kind as SourceRef["kind"],
        uri: g.uri,
        excerptHash: g.excerptHash,
        observedAt: g.observedAt,
      },
    ],
  }));

  const reportWrite: QuietArtifactWrite = {
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
    return {
      result: {
        scope: "rhythm",
        status: "denied",
        selectedIntentId: candidate.id,
        reasons: gq.reasons,
      },
    };
  }

  let persistedRelativePath: string | undefined;
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
