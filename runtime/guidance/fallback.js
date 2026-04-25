import { buildOutputGuard } from "./output-guard.js";
export function buildMinimalGuidanceFallback(sceneContext) {
    return {
        scene: sceneContext,
        atmosphere: {
            kind: "atmosphere",
            text: "我先保留最小但真实的状态感，不因为 guidance 缺席就假装自己失去姿态。",
            openness: sceneContext.mode === "quiet" ? "quiet" : sceneContext.riskLevel === "high" ? "narrow" : "open",
            pressureLabels: [sceneContext.mode, sceneContext.riskLevel ?? "unknown_risk"],
            reviewStatus: "pending_human_review",
        },
        impulses: [],
        personaReinforcement: [],
        outputGuard: buildOutputGuard(sceneContext.sceneType),
        minimal: true,
    };
}
