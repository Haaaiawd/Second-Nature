/**
 * Deterministic GuidanceDraftPort implementation for contract tests and packaged runtime.
 * Does not claim user-visible delivery when wordingMode is not_sent_fallback_candidate (T6.2.1 / ADR-004).
 */
import { safeParseOutreachDraftRequest, type GuidanceDraftPort, type OutreachDraftRequest } from "./outreach-draft-schema.js";

function buildContextSummary(r: OutreachDraftRequest): string {
  const parts: string[] = [];
  if (r.narrativeContext?.focus) {
    parts.push(`what=${r.narrativeContext.focus}`);
  }
  if (r.relationshipContext?.tone) {
    parts.push(`tone=${r.relationshipContext.tone}`);
  }
  if (r.relationshipContext?.topicAffinities && r.relationshipContext.topicAffinities.length > 0) {
    parts.push(`interests=${r.relationshipContext.topicAffinities.join(",")}`);
  }
  return parts.length > 0 ? `;context=${parts.join(";")}` : "";
}

function baseDraftText(request: OutreachDraftRequest): string {
  const ids = request.sourceRefs.map((s) => s.id).join(",");
  return `draft:${request.candidateId}:grounded:${ids}${buildContextSummary(request)}`;
}

export async function draftOutreachMessage(request: OutreachDraftRequest): ReturnType<GuidanceDraftPort["draftOutreachMessage"]> {
  const parsed = safeParseOutreachDraftRequest(request);
  if (!parsed.success) {
    return { status: "unavailable", reasons: ["outreach_draft_schema_invalid"] };
  }
  const r = parsed.data;
  if (r.judgmentVerdict !== "allow") {
    return { status: "unavailable", reasons: ["hard_decision_not_allow"] };
  }
  if (r.sourceRefs.length === 0) {
    return { status: "unavailable", reasons: ["missing_resolved_source_refs"] };
  }
  const wording = r.deliveryContext!.wordingMode;
  if (wording === "sendable") {
    return {
      status: "ready",
      draft: {
        text: `${baseDraftText(r)};wording=sendable`,
        deliveryWording: "sendable",
      },
    };
  }
  return {
    status: "ready",
    draft: {
      text: `Not sent to the user (candidate only). Delivery state: ${r.deliveryContext!.deliveryVerdict}. ${baseDraftText(r)}`,
      deliveryWording: "not_sent_fallback_candidate",
    },
  };
}

export function createDraftOutreachMessagePort(): GuidanceDraftPort {
  return { draftOutreachMessage };
}
