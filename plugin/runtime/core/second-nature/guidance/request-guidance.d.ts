import { type GuidanceFallback, type GuidancePayload, type GuidanceUnavailable, type PersonaCandidate, type SceneContext } from "../../../guidance/index.js";
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
export declare function requestGuidance(input: {
    sceneContext: SceneContext;
    personaCandidates?: PersonaCandidate[];
    port?: RequestGuidancePort;
}): Promise<RequestGuidanceResult>;
