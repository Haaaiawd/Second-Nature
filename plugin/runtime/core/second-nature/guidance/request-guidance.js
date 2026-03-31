import { assembleGuidance, buildMinimalGuidanceFallback, } from "../../../guidance/index.js";
export async function requestGuidance(input) {
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
