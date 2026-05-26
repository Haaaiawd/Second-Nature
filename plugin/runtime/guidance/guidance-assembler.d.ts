import { type PlatformImpulsePort } from "./impulse-assembler.js";
import type { GuidancePayload, GuidanceUnavailable, PersonaCandidate, SceneContext } from "./types.js";
export declare function assembleGuidance(input: {
    sceneContext: SceneContext | null | undefined;
    personaCandidates?: PersonaCandidate[];
    platformImpulsePort?: PlatformImpulsePort;
}): Promise<GuidancePayload | GuidanceUnavailable>;
