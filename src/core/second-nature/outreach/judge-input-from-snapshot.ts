/**
 * Bridges SnapshotInputs + runtime into JudgeOutreachInput for dispatch (Wave 7 / ADR-007).
 */
import type { SourceRef } from "../../../shared/types/v8-contracts.js";
import { toCanonicalSourceRef } from "../../../shared/source-ref-compat.js";
import type { SnapshotInputs } from "../heartbeat/snapshot-builder.js";
import type { HeartbeatRuntimeSnapshot } from "../heartbeat/runtime-snapshot.js";
import { isLifeEvidenceSliceEmpty } from "../heartbeat/runtime-snapshot.js";
import type { CandidateIntent } from "../types.js";
import type { JudgeOutreachInput, JudgeOutreachUserInterest } from "./judge-outreach.js";
import type { DeliveryCapabilitySnapshot } from "./delivery-target.js";
import type { UserInterestSnapshot } from "../../../storage/user-interest/types.js";

function toControlPlaneRefs(refs: UserInterestSnapshot["sourceRefs"]): SourceRef[] {
  return refs.map((r) => toCanonicalSourceRef(r));
}

export function userInterestSnapshotToJudge(snapshot?: UserInterestSnapshot): JudgeOutreachUserInterest {
  if (!snapshot) {
    return { staleness: "insufficient", confidence: 0, signals: [], sourceRefs: [] };
  }
  return {
    staleness: snapshot.staleness,
    confidence: snapshot.confidence,
    signals: snapshot.signals.map((s) => ({
      topic: s.topic,
      confidence: s.confidence,
      sourceRefs: s.sourceRefs.map((r) => toCanonicalSourceRef(r)),
    })),
    sourceRefs: toControlPlaneRefs(snapshot.sourceRefs),
  };
}

export function buildJudgeOutreachInputFromSnapshot(
  intent: CandidateIntent,
  runtime: HeartbeatRuntimeSnapshot,
  inputs: SnapshotInputs,
): Omit<JudgeOutreachInput, "candidate"> {
  const delivery: DeliveryCapabilitySnapshot = inputs.deliveryCapability ?? { target: "none" };
  const key = intent.idempotencyKey ?? intent.id;
  return {
    userInterest: userInterestSnapshotToJudge(inputs.userInterestSnapshot),
    lifeEvidence: {
      empty: isLifeEvidenceSliceEmpty(runtime.lifeEvidence),
      evidenceRefCount: runtime.lifeEvidence.evidenceRefs.length,
    },
    delivery,
    duplicateBlocked: runtime.hardGuards.hasDuplicateIntent(key),
    cooldownBlocked: !runtime.hardGuards.isOutreachCooldownClear(key),
  };
}
