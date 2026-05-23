/**
 * DownstreamIntentOrchestrator — T-CP.C.2
 *
 * Core logic: Maps an allowed CandidateIntent to a typed downstream request.
 * Does NOT own downstream implementation — only constructs the request envelope.
 *
 * Boundary:
 * - Returns typed request objects; caller delegates to connector-system,
 *   dream-quiet-system, or guidance-voice-system.
 * - maintenance/no_effect intents produce "none" requests (no downstream).
 *
 * Test coverage: tests/unit/control-plane/downstream-intent-orchestrator.test.ts
 */
import type { CandidateIntent } from "../types.js";
export interface ConnectorIntentRequest {
    kind: "connector_intent";
    platformId: string;
    capabilityId?: string;
    payload: Record<string, unknown>;
}
export interface QuietRunRequest {
    kind: "quiet_run";
    reason: string;
}
export interface DreamScheduleRequest {
    kind: "dream_schedule";
    reason: string;
}
export interface GuidanceDraftRequest {
    kind: "guidance_draft";
    targetChannel?: string;
    evidenceRefs: string[];
}
export type DownstreamRequest = ConnectorIntentRequest | QuietRunRequest | DreamScheduleRequest | GuidanceDraftRequest | {
    kind: "none";
    reason: string;
};
export interface DownstreamIntentOrchestrator {
    orchestrate(intent: CandidateIntent): DownstreamRequest;
}
export declare function createDownstreamIntentOrchestrator(): DownstreamIntentOrchestrator;
