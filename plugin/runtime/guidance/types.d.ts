export type GuidanceSceneType = "social" | "reply" | "outreach" | "quiet" | "explain" | "user_reply";
export type GuidanceMode = "active" | "quiet" | "maintenance_only" | "paused_for_interrupt";
export type GuidanceRiskLevel = "low" | "medium" | "high";
export type AtmosphereOpenness = "open" | "narrow" | "quiet";
export type ImpulseKind = "social" | "reply" | "outreach" | "quiet";
export type PersonaSource = "SOUL" | "USER" | "IDENTITY" | "MEMORY";
export type TemplateReviewStatus = "pending_human_review" | "approved" | "rejected";
export interface SceneContext {
    sceneType: GuidanceSceneType;
    mode: GuidanceMode;
    windowId?: string;
    riskLevel?: GuidanceRiskLevel;
    sceneSummary?: string;
    constraintSummary?: string[];
}
export interface AtmosphereBlock {
    kind: "atmosphere";
    text: string;
    openness: AtmosphereOpenness;
    pressureLabels: string[];
    reviewStatus: TemplateReviewStatus;
}
export interface ImpulseBlock {
    kind: ImpulseKind;
    text: string;
    reviewStatus: TemplateReviewStatus;
}
export interface PersonaCandidate {
    id: string;
    source: PersonaSource;
    text: string;
    tags: string[];
}
export interface PersonaSnippet {
    candidateId: string;
    source: PersonaSource;
    text: string;
    rationale: string;
}
export interface GuardBlock {
    kind: "output_guard";
    constraints: string[];
    hardGuardPriority: true;
}
export interface PersonaInjectionBudget {
    maxSnippets: number;
    maxTotalCharacters: number;
}
export interface GuidancePayload {
    scene: SceneContext;
    atmosphere?: AtmosphereBlock;
    impulses: ImpulseBlock[];
    personaReinforcement: PersonaSnippet[];
    outputGuard?: GuardBlock;
}
export interface GuidanceUnavailable {
    available: false;
    reason: "guidance_not_configured" | "missing_scene_context" | "missing_template" | "persona_assets_unavailable";
}
export interface GuidanceFallback {
    scene: SceneContext;
    atmosphere?: AtmosphereBlock;
    impulses: ImpulseBlock[];
    personaReinforcement: [];
    outputGuard: GuardBlock;
    minimal: true;
}
export interface PersonaSelectionDecision {
    sceneType: GuidanceSceneType;
    budget: PersonaInjectionBudget;
    snippets: PersonaSnippet[];
}
