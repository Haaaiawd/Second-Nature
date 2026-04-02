import { buildMinimalGuidanceFallback } from "./fallback.js";
import { buildOutputGuard } from "./output-guard.js";
import { selectPersonaSnippets } from "./persona-selection.js";
import { getBaselineAtmosphereTemplate, getImpulseTemplate } from "./template-registry.js";
import type {
  AtmosphereBlock,
  GuidancePayload,
  GuidanceUnavailable,
  ImpulseBlock,
  PersonaCandidate,
  SceneContext,
} from "./types.js";

async function buildAtmosphere(sceneContext: SceneContext): Promise<AtmosphereBlock> {
  const template = getBaselineAtmosphereTemplate();
  return {
    kind: "atmosphere",
    text: template.text,
    openness: sceneContext.mode === "quiet" ? "quiet" : sceneContext.riskLevel === "high" ? "narrow" : "open",
    pressureLabels: [sceneContext.mode, sceneContext.riskLevel ?? "unknown_risk"],
    reviewStatus: template.reviewStatus,
  };
}

async function selectImpulses(sceneContext: SceneContext): Promise<ImpulseBlock[]> {
  if (sceneContext.sceneType === "explain" || sceneContext.sceneType === "user_reply") {
    return [];
  }

  return [getImpulseTemplate(sceneContext.sceneType)];
}

export async function assembleGuidance(input: {
  sceneContext: SceneContext | null | undefined;
  personaCandidates?: PersonaCandidate[];
}): Promise<GuidancePayload | GuidanceUnavailable> {
  if (!input.sceneContext) {
    return {
      available: false,
      reason: "missing_scene_context",
    };
  }

  const sceneContext = input.sceneContext;

  try {
    const [atmosphere, impulses] = await Promise.all([
      buildAtmosphere(sceneContext),
      selectImpulses(sceneContext),
    ]);

    const personaDecision = selectPersonaSnippets({
      sceneContext,
      candidates: input.personaCandidates ?? [],
    });

    return {
      scene: sceneContext,
      atmosphere,
      impulses,
      personaReinforcement: personaDecision.snippets,
      outputGuard: buildOutputGuard(sceneContext.sceneType),
    };
  } catch {
    if ((input.personaCandidates ?? []).length === 0) {
      const fallback = buildMinimalGuidanceFallback(sceneContext);
      return {
        scene: fallback.scene,
        atmosphere: fallback.atmosphere,
        impulses: fallback.impulses,
        personaReinforcement: fallback.personaReinforcement,
        outputGuard: fallback.outputGuard,
      };
    }

    return {
      available: false,
      reason: "missing_template",
    };
  }
}
