export function applyGuidance(input) {
    return {
        source: "minimal" in input && input.minimal ? "minimal_fallback" : "guidance_payload",
        sceneType: input.scene.sceneType,
        atmosphereText: input.atmosphere?.text,
        impulseTexts: input.impulses.map((item) => item.text),
        personaRationales: input.personaReinforcement.map((item) => item.rationale),
        outputConstraints: input.outputGuard?.constraints ?? [],
    };
}
