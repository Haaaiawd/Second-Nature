import type { GuidancePayload, GuidanceUnavailable, PersonaCandidate, SceneContext } from "./types.js";
export declare function assembleGuidance(input: {
    sceneContext: SceneContext | null | undefined;
    personaCandidates?: PersonaCandidate[];
}): Promise<GuidancePayload | GuidanceUnavailable>;
