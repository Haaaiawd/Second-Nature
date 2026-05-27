export type GuidanceSceneType = "social" | "reply" | "outreach" | "quiet" | "explain" | "user_reply";

export type GuidanceMode = "active" | "quiet" | "maintenance_only" | "paused_for_interrupt";

export type GuidanceRiskLevel = "low" | "medium" | "high";

export type AtmosphereOpenness = "open" | "narrow" | "quiet";

export type ImpulseKind = "social" | "reply" | "outreach" | "quiet" | "explore" | "work";

export type PersonaSource = "SOUL" | "USER" | "IDENTITY" | "MEMORY";

export type TemplateReviewStatus = "pending_human_review" | "approved" | "rejected";

export interface SceneContext {
  sceneType: GuidanceSceneType;
  mode: GuidanceMode;
  windowId?: string;
  riskLevel?: GuidanceRiskLevel;
  sceneSummary?: string;
  constraintSummary?: string[];
  /**
   * T-V7C.C.4R: The capability being executed (e.g. "post.publish", "feed.read").
   * Used by ImpulseAssembler to derive capabilityClass for dual-axis impulse selection.
   * When absent, assembler falls back to sceneType-based impulse.
   */
  capabilityIntent?: string;
  /**
   * T-V7C.C.4R: The target platform identifier (e.g. "moltbook", "instreet").
   * Used by ImpulseAssembler to check for platform-specific impulse overrides.
   * When absent, platform-specific lookup is skipped.
   */
  platformId?: string;
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
  /** @deprecated Use ExpressionBoundaryBlock via buildExpressionBoundary. Kept for backward compatibility. */
  _semanticNote?: "output_guard_only_shapes_expression";
}

export interface ExpressionBoundaryBlock {
  kind: "expression_boundary";
  constraints: string[];
  /** Avoid/prefer style constraints; never format specs or hard guard verdicts. */
  style: "avoid_prefer";
  /** Explicitly marks this block as shaping expression only, not action allow/deny. */
  ownership: "behavioral_guidance_system";
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
  /** @deprecated Use expressionBoundary. Kept for backward compatibility. */
  outputGuard?: GuardBlock;
  expressionBoundary?: ExpressionBoundaryBlock;
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
  /** @deprecated Use expressionBoundary. Kept for backward compatibility. */
  outputGuard: GuardBlock;
  expressionBoundary?: ExpressionBoundaryBlock;
  minimal: true;
}

export interface PersonaSelectionDecision {
  sceneType: GuidanceSceneType;
  budget: PersonaInjectionBudget;
  snippets: PersonaSnippet[];
}
