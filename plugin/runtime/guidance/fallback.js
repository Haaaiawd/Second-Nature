import { buildOutputGuard, buildExpressionBoundary } from "./output-guard.js";
import { getShortAtmosphereTemplate } from "./template-registry.js";
export function buildMinimalGuidanceFallback(sceneContext) {
    const atmosphereTemplate = getShortAtmosphereTemplate(sceneContext.mode, sceneContext.riskLevel);
    return {
        scene: sceneContext,
        atmosphere: {
            kind: "atmosphere",
            text: atmosphereTemplate.text,
            openness: sceneContext.mode === "quiet" ? "quiet" : sceneContext.riskLevel === "high" ? "narrow" : "open",
            pressureLabels: [sceneContext.mode, sceneContext.riskLevel ?? "unknown_risk"],
            reviewStatus: atmosphereTemplate.reviewStatus,
        },
        impulses: [],
        personaReinforcement: [],
        outputGuard: buildOutputGuard(sceneContext.sceneType),
        expressionBoundary: buildExpressionBoundary(sceneContext.sceneType),
        minimal: true,
    };
}
