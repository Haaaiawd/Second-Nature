import type { PersonaCandidate, SceneContext } from "../../guidance/types.js";
export interface PersonaCandidateLoader {
    loadPersonaCandidates(sceneContext: SceneContext): Promise<PersonaCandidate[]>;
}
export declare function createPersonaCandidateLoader(): PersonaCandidateLoader;
