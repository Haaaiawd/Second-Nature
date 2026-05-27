import type { GuidanceFallback, GuidancePayload } from "../../../guidance/index.js";

export interface AppliedGuidanceContext {
  source: "guidance_payload" | "minimal_fallback";
  sceneType: string;
  atmosphereText?: string;
  impulseTexts: string[];
  personaRationales: string[];
  /** @deprecated Use expressionConstraints. Kept for backward compatibility. */
  outputConstraints: string[];
  expressionConstraints: string[];
}

export function applyGuidance(input: GuidancePayload | GuidanceFallback): AppliedGuidanceContext {
  const isMinimal = "minimal" in input && input.minimal;
  const boundaryConstraints = input.expressionBoundary?.constraints
    ?? input.outputGuard?.constraints
    ?? [];
  return {
    source: isMinimal ? "minimal_fallback" : "guidance_payload",
    sceneType: input.scene.sceneType,
    atmosphereText: input.atmosphere?.text,
    impulseTexts: input.impulses.map((item) => item.text),
    personaRationales: input.personaReinforcement.map((item) => item.rationale),
    outputConstraints: input.outputGuard?.constraints ?? [],
    expressionConstraints: boundaryConstraints,
  };
}
