import { buildMinimalGuidanceFallback } from "./fallback.js";
import { buildOutputGuard, buildExpressionBoundary } from "./output-guard.js";
import { selectPersonaSnippets } from "./persona-selection.js";
import { getShortAtmosphereTemplate } from "./template-registry.js";
import { assembleImpulse, type PlatformImpulsePort } from "./impulse-assembler.js";
import type {
  AtmosphereBlock,
  GuidancePayload,
  GuidanceUnavailable,
  ImpulseBlock,
  PersonaCandidate,
  SceneContext,
} from "./types.js";

async function buildAtmosphere(sceneContext: SceneContext): Promise<AtmosphereBlock> {
  const template = getShortAtmosphereTemplate(sceneContext.mode, sceneContext.riskLevel);
  return {
    kind: "atmosphere",
    text: template.text,
    openness: sceneContext.mode === "quiet" ? "quiet" : sceneContext.riskLevel === "high" ? "narrow" : "open",
    pressureLabels: [sceneContext.mode, sceneContext.riskLevel ?? "unknown_risk"],
    reviewStatus: template.reviewStatus,
  };
}

/**
 * Select impulses using the dual-axis capabilityClass assembler (T-V7C.C.4R).
 *
 * Fallback chain: platform-specific → capabilityClass preset → intentKind → []
 */
async function selectImpulses(
  sceneContext: SceneContext,
  deps: { platformImpulsePort?: PlatformImpulsePort },
): Promise<ImpulseBlock[]> {
  if (sceneContext.sceneType === "explain" || sceneContext.sceneType === "user_reply") {
    return [];
  }

  const result = await assembleImpulse(
    {
      sceneType: sceneContext.sceneType,
      capabilityIntent: sceneContext.capabilityIntent,
      platformId: sceneContext.platformId,
    },
    deps,
  );

  return result.impulse ? [result.impulse] : [];
}

export async function assembleGuidance(input: {
  sceneContext: SceneContext | null | undefined;
  personaCandidates?: PersonaCandidate[];
  platformImpulsePort?: PlatformImpulsePort;
}): Promise<GuidancePayload | GuidanceUnavailable> {
  if (!input.sceneContext) {
    return {
      available: false,
      reason: "missing_scene_context",
    };
  }

  const sceneContext = input.sceneContext;
  const deps = { platformImpulsePort: input.platformImpulsePort };

  try {
    const [atmosphere, impulses] = await Promise.all([
      buildAtmosphere(sceneContext),
      selectImpulses(sceneContext, deps),
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
      expressionBoundary: buildExpressionBoundary(sceneContext.sceneType),
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
        expressionBoundary: fallback.expressionBoundary,
      };
    }

    return {
      available: false,
      reason: "missing_template",
    };
  }
}
