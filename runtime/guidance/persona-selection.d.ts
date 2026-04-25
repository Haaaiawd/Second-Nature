import type { GuidanceSceneType, PersonaCandidate, PersonaInjectionBudget, PersonaSelectionDecision, PersonaSource, SceneContext } from "./types.js";
export interface PersonaSelectionPolicy {
    readonly sourcePriority: readonly PersonaSource[];
    readonly preferredTags: readonly string[];
    readonly budget: PersonaInjectionBudget;
}
export declare function getPersonaSelectionPolicy(sceneType: GuidanceSceneType): PersonaSelectionPolicy;
export declare function selectPersonaSnippets(input: {
    sceneContext: SceneContext;
    candidates: PersonaCandidate[];
}): PersonaSelectionDecision;
