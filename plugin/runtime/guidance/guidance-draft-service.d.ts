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
export type DraftServiceError = "draft_source_invalidated" | "evidence_pack_unavailable" | "unsupported_scene_kind";
export interface DraftServiceResult {
    draft?: DraftMessage;
    error?: DraftServiceError;
}
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
export declare function generateGuidanceDraft(request: GuidanceDraftRequest, deps: {
    evidencePort: DraftEvidencePackPort;
}): Promise<DraftServiceResult>;
export interface DraftValidationResult {
    valid: boolean;
    invalidated?: boolean;
    reason?: DraftServiceError;
}
export declare function validateDraftSources(draft: DraftMessage, deps: {
    validatorPort: SourceValidatorPort;
}): Promise<DraftValidationResult>;
