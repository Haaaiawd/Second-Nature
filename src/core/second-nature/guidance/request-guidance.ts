import {
  assembleGuidance,
  buildMinimalGuidanceFallback,
  type GuidanceFallback,
  type GuidancePayload,
  type GuidanceUnavailable,
  type PersonaCandidate,
  type SceneContext,
} from "../../../guidance/index.js";

export interface RequestGuidancePort {
  assembleGuidance(input: {
    sceneContext: SceneContext;
    personaCandidates: PersonaCandidate[];
  }): Promise<GuidancePayload | GuidanceUnavailable>;
}

export interface RequestGuidanceResult {
  owner: "control-plane-system";
  sceneContext: SceneContext;
  guidance: GuidancePayload | GuidanceFallback;
  usedFallback: boolean;
}

export async function requestGuidance(input: {
  sceneContext: SceneContext;
  personaCandidates?: PersonaCandidate[];
  port?: RequestGuidancePort;
}): Promise<RequestGuidanceResult> {
  const port = input.port ?? { assembleGuidance };
  const result = await port.assembleGuidance({
    sceneContext: input.sceneContext,
    personaCandidates: input.personaCandidates ?? [],
  });

  if ("available" in result) {
    return {
      owner: "control-plane-system",
      sceneContext: input.sceneContext,
      guidance: buildMinimalGuidanceFallback(input.sceneContext),
      usedFallback: true,
    };
  }

  return {
    owner: "control-plane-system",
    sceneContext: input.sceneContext,
    guidance: result,
    usedFallback: false,
  };
}
