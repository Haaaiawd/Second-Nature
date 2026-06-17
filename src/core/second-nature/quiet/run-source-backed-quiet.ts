/**
 * Quiet / reflection orchestration: empty evidence → empty_state; otherwise coverage-gated artifact (T2.3.3).
 *
 * v7 T-V7C.C.3: After a successful Quiet artifact write, if a DreamSchedulePort is provided,
 * automatically trigger scheduleDream(quiet_completion). Skip reason is embedded in HeartbeatCycleResult
 * reasons when the scheduler returns "skipped" (e.g. lock held).
 */
import type { CandidateIntent } from "../types.js";
import type { HeartbeatRuntimeSnapshot } from "../heartbeat/runtime-snapshot.js";
import { isLifeEvidenceSliceEmpty } from "../heartbeat/runtime-snapshot.js";
import type { HeartbeatCycleResult } from "../heartbeat/signal.js";
import type { LifeEvidenceSourceRef } from "../../../storage/life-evidence/types.js";
import { writeQuietArtifact, type QuietArtifactAck } from "../../../storage/quiet/quiet-artifact-writer.js";
import type { QuietArtifactWrite, QuietClaim } from "../../../storage/quiet/quiet-artifact-types.js";
import { persistQuietArtifactToWorkspace } from "../../../storage/quiet/persist-quiet-artifact.js";
import type { GuidanceSourceRef } from "../../../guidance/outreach-draft-schema.js";
import { buildEvidencePack, buildQuietNarrativeGuidance, selectInterestBasis } from "../../../guidance/evidence-guidance.js";
import type { UserInterestSnapshot } from "../../../storage/user-interest/types.js";
import type { AppendOnlyAuditStore } from "../../../observability/audit/append-only-audit-store.js";
import { recordQuietArtifactAudit } from "../../../observability/services/audit-closure-recorders.js";
import { legacyKindFromSourceRef } from "../../../shared/source-ref-compat.js";

/**
 * Minimal port for triggering Dream after Quiet completion (T-V7C.C.3).
 * Kept narrow so run-source-backed-quiet does not take a hard dependency on dream-scheduler.
 */
export interface QuietDreamSchedulePort {
  scheduleDream(params: {
    triggerKind: "quiet_completion";
    runId: string;
    traceId: string;
  }): Promise<{ status: "started" | "skipped" | "queued"; reason?: string }>;
}

function toGuidanceRef(r: CandidateIntent["sourceRefs"][number]): GuidanceSourceRef {
  return {
    id: r.id,
    kind: legacyKindFromSourceRef(r) as GuidanceSourceRef["kind"],
    uri: r.uri,
  };
}

function toLifeEvidenceRef(ref: GuidanceSourceRef): LifeEvidenceSourceRef {
  return {
    id: ref.id,
    kind: ref.kind as LifeEvidenceSourceRef["kind"],
    uri: ref.uri,
    excerptHash: ref.excerptHash,
    observedAt: ref.observedAt,
  };
}

export interface RunSourceBackedQuietParams {
  candidate: CandidateIntent;
  runtime: HeartbeatRuntimeSnapshot;
  day: string;
  userInterestSnapshot?: UserInterestSnapshot;
  workspaceRoot?: string;
  /** v7 T-V7C.C.3: when present, a successful Quiet artifact write auto-triggers Dream scheduling. */
  dreamSchedulePort?: QuietDreamSchedulePort;
  /** T-OBS.R.1: when present, Quiet outcomes write audit truth consumed by heartbeat_digest. */
  auditStore?: AppendOnlyAuditStore;
}

export interface RunSourceBackedQuietResult {
  result: HeartbeatCycleResult;
  artifactAck?: QuietArtifactAck;
  persistedRelativePath?: string;
}

/**
 * v7 T-V7C.C.3: Fire-and-forget Dream schedule after successful Quiet write.
 * Returns the schedule status reason string to embed in HeartbeatCycleResult reasons.
 * Never throws — Dream scheduling failure must not break the Quiet cycle result.
 */
async function maybeScheduleDreamAfterQuiet(
  dreamSchedulePort: QuietDreamSchedulePort | undefined,
  day: string,
): Promise<string | undefined> {
  if (!dreamSchedulePort) return undefined;
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[run-source-backed-quiet] Dream schedule failed: ${msg}`);
    return `quiet_dream_schedule_error:${msg.slice(0, 60)}`;
  }
}

export async function runSourceBackedQuiet(params: RunSourceBackedQuietParams): Promise<RunSourceBackedQuietResult> {
  const { candidate, runtime, day, userInterestSnapshot, workspaceRoot, dreamSchedulePort, auditStore } = params;
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

  const claims: QuietClaim[] = ep.pack.groundedRefs.map((g, i) => ({
    id: `fact:${g.id}`,
    text: `Evidence-backed note ${i + 1}`,
    claimType: "fact",
    sourceRefs: [
      {
        ...toLifeEvidenceRef(g),
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

  let persistedRelativePath: string | undefined;
  if (workspaceRoot) {
    const p = await persistQuietArtifactToWorkspace(workspaceRoot, ack, reportWrite);
    persistedRelativePath = p.relativePath;
  }

  // v7 T-V7C.C.3: After a successful source-backed Quiet write, auto-trigger Dream scheduling.
  const dreamReason = await maybeScheduleDreamAfterQuiet(dreamSchedulePort, day);
  const reasons: string[] = ["quiet_artifact_written", ...gq.hints.slice(0, 2)];
  if (dreamReason) reasons.push(dreamReason);
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
