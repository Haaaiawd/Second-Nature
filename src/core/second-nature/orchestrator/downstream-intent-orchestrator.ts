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

export type DownstreamRequest =
  | ConnectorIntentRequest
  | QuietRunRequest
  | DreamScheduleRequest
  | GuidanceDraftRequest
  | { kind: "none"; reason: string };

export interface DownstreamIntentOrchestrator {
  orchestrate(intent: CandidateIntent): DownstreamRequest;
}

export function createDownstreamIntentOrchestrator(): DownstreamIntentOrchestrator {
  return {
    orchestrate(intent): DownstreamRequest {
      switch (intent.effectClass) {
        case "connector_action":
        case "external_platform_action":
          return {
            kind: "connector_intent",
            platformId: intent.platformId ?? "unknown",
            capabilityId: intent.capabilityIntent,
            payload: {
              sourceRefs: intent.sourceRefs.map((r) => r.id),
              summary: intent.summary,
            },
          };
        case "user_outreach":
          return {
            kind: "guidance_draft",
            targetChannel: intent.platformId,
            evidenceRefs: intent.sourceRefs.map((r) => r.id),
          };
        case "narrative_reflection":
          return { kind: "quiet_run", reason: "narrative_reflection" };
        case "maintenance":
        case "no_effect":
          return {
            kind: "none",
            reason: "no_downstream_for_maintenance",
          };
        case "memory_curation":
          return {
            kind: "dream_schedule",
            reason: "memory_curation",
          };
        default:
          return {
            kind: "none",
            reason: `unhandled_effect_class:${intent.effectClass}`,
          };
      }
    },
  };
}
