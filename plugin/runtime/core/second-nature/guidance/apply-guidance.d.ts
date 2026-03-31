import type { GuidanceFallback, GuidancePayload } from "../../../guidance/index.js";
export interface AppliedGuidanceContext {
    source: "guidance_payload" | "minimal_fallback";
    sceneType: string;
    atmosphereText?: string;
    impulseTexts: string[];
    personaRationales: string[];
    outputConstraints: string[];
}
export declare function applyGuidance(input: GuidancePayload | GuidanceFallback): AppliedGuidanceContext;
