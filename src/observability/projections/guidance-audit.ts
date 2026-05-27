import type { GuidancePayload, GuidanceUnavailable, PersonaSnippet, SceneContext } from "../../guidance/types.js";

export interface GuidanceParticipationAudit {
  id: string;
  sceneContext: SceneContext;
  payload: GuidancePayload | GuidanceUnavailable;
  usedFallback: boolean;
}

export interface GuidanceParticipationProjection {
  eventId: string;
  sceneType: SceneContext["sceneType"];
  usedFallback: boolean;
  guidanceAvailable: boolean;
  blockSummary: string[];
  snippetRationales: string[];
}

function summarizePayloadBlocks(payload: GuidancePayload | GuidanceUnavailable): string[] {
  if ("available" in payload) {
    return [`unavailable:${payload.reason}`];
  }

  const blocks: string[] = [];
  if (payload.atmosphere) {
    blocks.push("atmosphere");
  }
  if (payload.impulses.length > 0) {
    blocks.push(...payload.impulses.map((item) => `impulse:${item.kind}`));
  }
  if (payload.personaReinforcement.length > 0) {
    blocks.push(`persona:${payload.personaReinforcement.length}`);
  }
  if (payload.expressionBoundary) {
    blocks.push("expression_boundary");
  } else if (payload.outputGuard) {
    blocks.push("output_guard");
  }
  return blocks;
}

function summarizeRationales(payload: GuidancePayload | GuidanceUnavailable): string[] {
  if ("available" in payload) {
    return [];
  }

  return payload.personaReinforcement.map((item: PersonaSnippet) => item.rationale);
}

export function projectGuidanceParticipationAudit(input: GuidanceParticipationAudit): GuidanceParticipationProjection {
  return {
    eventId: input.id,
    sceneType: input.sceneContext.sceneType,
    usedFallback: input.usedFallback,
    guidanceAvailable: !(("available" in input.payload) && input.payload.available === false),
    blockSummary: summarizePayloadBlocks(input.payload),
    snippetRationales: summarizeRationales(input.payload),
  };
}
