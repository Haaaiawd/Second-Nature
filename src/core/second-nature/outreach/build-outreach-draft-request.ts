/**
 * Maps control-plane judgment + delivery resolution into guidance OutreachDraftRequest (T6.2.1).
 * Aligns with control-plane-system.detail §3.9 buildOutreachDraftRequest.
 */
import * as crypto from "node:crypto";
import type { OutreachDraftRequest } from "../../../guidance/outreach-draft-schema.js";
import type { CandidateIntent } from "../types.js";
import type { HeartbeatRuntimeSnapshot } from "../heartbeat/runtime-snapshot.js";
import type { OutreachJudgment } from "./judge-outreach.js";
import type { DeliveryTargetResolution } from "./delivery-target.js";
import type { NarrativeState } from "../../../storage/narrative/narrative-state-store.js";
import type { RelationshipMemory } from "../../../storage/relationship/relationship-memory-store.js";
import { legacyKindFromSourceRef } from "../../../shared/source-ref-compat.js";

function inferRhythmWindowKind(windowId: string): OutreachDraftRequest["rhythmWindowKind"] {
  const id = windowId.toLowerCase();
  if (id.includes("work")) return "work";
  if (id.includes("social")) return "social";
  if (id.includes("quiet")) return "quiet";
  if (id.includes("reflect")) return "reflection";
  if (id.includes("explore")) return "exploration";
  return undefined;
}

function toGuidanceRefs(refs: CandidateIntent["sourceRefs"]): OutreachDraftRequest["sourceRefs"] {
  return refs.map((r) => ({
    id: r.id,
    kind: legacyKindFromSourceRef(r),
    uri: r.uri,
  }));
}

function mapDeliveryVerdict(
  verdict: DeliveryTargetResolution["verdict"],
): NonNullable<OutreachDraftRequest["deliveryContext"]>["deliveryVerdict"] {
  switch (verdict) {
    case "target_available":
      return "target_available";
    case "target_none":
      return "target_none";
    case "channel_missing":
      return "channel_missing";
    case "host_unsupported":
      return "host_unsupported";
    default:
      return "host_unsupported";
  }
}

function buildNarrativeContext(
  state?: NarrativeState,
): NonNullable<OutreachDraftRequest["narrativeContext"]> | undefined {
  if (!state) return undefined;
  return {
    focus: state.focus || undefined,
    progress: state.progress.length > 0 ? state.progress : undefined,
    nextIntent: state.nextIntent || undefined,
    sourceRefs: state.sourceRefs.map((r) => ({
      id: r.sourceId,
      kind: "user_anchor" as const,
      uri: r.url || "",
      excerptHash: r.snippet,
      observedAt: undefined,
    })),
  };
}

function buildRelationshipContext(
  memory?: RelationshipMemory,
): NonNullable<OutreachDraftRequest["relationshipContext"]> | undefined {
  if (!memory) return undefined;
  const avgAffinity =
    memory.topicAffinities.length > 0
      ? memory.topicAffinities.reduce((s, t) => s + t.affinity, 0) /
        memory.topicAffinities.length
      : 0;
  return {
    tone: memory.tonePreference,
    topicAffinities: memory.topicAffinities.map((t) => t.topic),
    avgAffinity,
    sourceRefs: memory.sourceRefs?.map((r) => ({
      id: r.sourceId,
      kind: "user_anchor" as const,
      uri: r.url || "",
      excerptHash: r.snippet,
      observedAt: undefined,
    })),
  };
}

export function buildOutreachDraftRequest(
  candidate: CandidateIntent,
  judgment: OutreachJudgment,
  snapshot: HeartbeatRuntimeSnapshot,
  delivery: DeliveryTargetResolution,
  narrativeState?: NarrativeState,
  relationshipMemory?: RelationshipMemory,
): OutreachDraftRequest {
  const sceneType = delivery.verdict === "target_available" ? "outreach" : "fallback_candidate";
  const riskLevel = delivery.verdict === "target_available" ? "medium" : "low";
  return {
    requestId: `outreach_draft_request:${crypto.randomUUID()}`,
    sceneType,
    runtimeScope: "rhythm",
    rhythmWindowKind: inferRhythmWindowKind(snapshot.rhythmWindow.windowId),
    riskLevel,
    sourceRefs: toGuidanceRefs(judgment.sourceRefs),
    decisionId: judgment.decisionId,
    candidateId: candidate.id,
    judgmentVerdict: judgment.verdict,
    valueScore: judgment.valueScore,
    interestRefs: toGuidanceRefs(judgment.interestRefs),
    narrativeContext: buildNarrativeContext(narrativeState),
    relationshipContext: buildRelationshipContext(relationshipMemory),
    deliveryContext: {
      deliveryVerdict: mapDeliveryVerdict(delivery.verdict),
      wordingMode: delivery.verdict === "target_available" ? "sendable" : "not_sent_fallback_candidate",
    },
  };
}
