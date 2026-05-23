/**
 * GuidanceDraftService — T-GVS.C.1
 *
 * Core logic: source-backed draft generation with delivery-time re-validation.
 * Implements DR-028 (validateDraftSources) and DR-030 (GuidanceDraftRequest 7-field contract).
 *
 * Boundary:
 * - Generates DraftMessage with source_refs traced to evidence pack claims.
 * - validateDraftSources checks evidence availability before delivery; marks invalid
 *   if any source has been redacted or deleted, returning `draft_source_invalidated`.
 * - Does not own delivery; caller must validate before sending.
 *
 * Test coverage: tests/unit/guidance/guidance-draft-service.test.ts
 */

import type { GuidanceSourceRef } from "./outreach-draft-schema.js";

// ─── Contracts ──────────────────────────────────────────────────────────────

export interface GuidanceDraftRequest {
  requestId: string;
  sceneKind: "outreach" | "follow_up" | "reconnect";
  evidencePackRef: string;
  relationshipContextRef: string;
  channelHint?: string;
  ownerPreferenceRef?: string;
  requestedAt: string;
}

export interface DraftMessage {
  text: string;
  deliveryWording: "sendable" | "not_sent_fallback_candidate";
  sourceRefs: GuidanceSourceRef[];
  explanation?: string;
}

export type DraftServiceError =
  | "draft_source_invalidated"
  | "evidence_pack_unavailable"
  | "unsupported_scene_kind";

export interface DraftServiceResult {
  draft?: DraftMessage;
  error?: DraftServiceError;
}

// ─── Ports ──────────────────────────────────────────────────────────────────

export interface DraftEvidencePackClaim {
  id: string;
  text: string;
  sourceRefs: GuidanceSourceRef[];
}

export interface DraftEvidencePack {
  claims: DraftEvidencePackClaim[];
}

export interface DraftEvidencePackPort {
  loadEvidencePack(ref: string): Promise<DraftEvidencePack | undefined>;
}

export interface SourceValidatorPort {
  checkSourceAvailable(sourceRef: GuidanceSourceRef): Promise<boolean>;
}

// ─── Service ────────────────────────────────────────────────────────────────

export async function generateGuidanceDraft(
  request: GuidanceDraftRequest,
  deps: { evidencePort: DraftEvidencePackPort },
): Promise<DraftServiceResult> {
  const pack = await deps.evidencePort.loadEvidencePack(request.evidencePackRef);
  if (!pack) {
    return { error: "evidence_pack_unavailable" };
  }

  const allSourceRefs = pack.claims.flatMap((c) => c.sourceRefs);
  if (allSourceRefs.length === 0) {
    return { error: "draft_source_invalidated" };
  }

  const text = `Draft for ${request.sceneKind} (${request.requestId}): ${pack.claims
    .map((c) => c.text)
    .join("; ")}`;

  return {
    draft: {
      text,
      deliveryWording: "sendable",
      sourceRefs: allSourceRefs,
      explanation: `Generated from evidence pack ${request.evidencePackRef}`,
    },
  };
}

export async function validateDraftSources(
  draft: DraftMessage,
  deps: { validatorPort: SourceValidatorPort },
): Promise<{ valid: boolean; reason?: DraftServiceError }> {
  for (const ref of draft.sourceRefs) {
    const available = await deps.validatorPort.checkSourceAvailable(ref);
    if (!available) {
      return { valid: false, reason: "draft_source_invalidated" };
    }
  }
  return { valid: true };
}
