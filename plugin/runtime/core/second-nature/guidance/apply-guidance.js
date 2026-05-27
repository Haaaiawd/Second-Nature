export function applyGuidance(input) {
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
