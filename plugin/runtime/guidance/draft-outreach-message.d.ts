/**
 * Deterministic GuidanceDraftPort implementation for contract tests and packaged runtime.
 * Does not claim user-visible delivery when wordingMode is not_sent_fallback_candidate (T6.2.1 / ADR-004).
 */
import { type GuidanceDraftPort, type OutreachDraftRequest } from "./outreach-draft-schema.js";
export declare function draftOutreachMessage(request: OutreachDraftRequest): ReturnType<GuidanceDraftPort["draftOutreachMessage"]>;
export declare function createDraftOutreachMessagePort(): GuidanceDraftPort;
