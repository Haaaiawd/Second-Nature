/**
 * User Reply Light Continuity Contract
 *
 * Per T6.1.1: Provides very light continuity guidance for direct user replies.
 * This is separate from the platform `reply` scene - it only provides
 * lightweight persona continuity and tone consistency for user-facing chat.
 *
 * Key differences from platform `reply` scene:
 * - No platform-specific impulses
 * - No comment/reply formatting constraints
 * - Only persona continuity and minimal tone guidance
 * - Does not enter the reply scene impulse system
 */
import type { SceneContext, GuidanceFallback, GuidancePayload, ImpulseBlock, PersonaSnippet, GuardBlock } from "../../../guidance/index.js";
import { buildMinimalGuidanceFallback } from "../../../guidance/fallback.js";
import { buildOutputGuard } from "../../../guidance/output-guard.js";
import { selectPersonaSnippets } from "../../../guidance/persona-selection.js";
import { getBaselineAtmosphereTemplate } from "../../../guidance/template-registry.js";
import type { PersonaCandidate, AtmosphereBlock } from "../../../guidance/index.js";

/**
 * Scene context for user reply - uses a distinct scene type
 * to avoid confusion with platform reply scene.
 */
export const USER_REPLY_SCENE_TYPE = "user_reply" as const;
export type UserReplySceneType = typeof USER_REPLY_SCENE_TYPE;

/**
 * Build very light continuity guidance for direct user replies.
 *
 * Returns a minimal guidance payload with:
 * - Light atmosphere (continuity-focused)
 * - NO impulses (unlike platform reply scene)
 * - Optional persona reinforcement (1-2 snippets max)
 * - Minimal output guard (tone consistency only)
 */
export async function buildLightReplyContinuity(input: {
  replyContext: {
    recentTone?: string;
    lastInteractionSummary?: string;
  };
  personaCandidates?: PersonaCandidate[];
}): Promise<GuidancePayload | GuidanceFallback> {
  const sceneContext: SceneContext = {
    sceneType: "explain", // Use explain as base - no platform-specific scene needed
    mode: "active",
    riskLevel: "low",
    sceneSummary: "direct user reply continuity",
  };

  try {
    // Light atmosphere - continuity focused
    const atmosphereTemplate = getBaselineAtmosphereTemplate();
    const atmosphere: AtmosphereBlock = {
      kind: "atmosphere",
      text: `保持同一个人的语气。${input.replyContext.recentTone ? `最近语气参考：${input.replyContext.recentTone}` : "延续既有连续感。"}`,
      openness: "open",
      pressureLabels: ["user_reply", "continuity"],
      reviewStatus: atmosphereTemplate.reviewStatus,
    };

    // NO impulses for user reply - this is the key difference from platform reply
    const impulses: ImpulseBlock[] = [];

    // Minimal persona reinforcement - only if candidates available
    let personaReinforcement: PersonaSnippet[] = [];
    if (input.personaCandidates && input.personaCandidates.length > 0) {
      const personaDecision = selectPersonaSnippets({
        sceneContext,
        candidates: input.personaCandidates.slice(0, 2), // Max 2 snippets for light continuity
      });
      personaReinforcement = personaDecision.snippets;
    }

    // Minimal output guard - tone consistency only
    const outputGuard: GuardBlock = {
      kind: "output_guard",
      constraints: [
        "保持对话语气，不要用帖子回复腔",
        "延续同一个人格连续性",
      ],
      hardGuardPriority: true,
    };

    return {
      scene: sceneContext,
      atmosphere,
      impulses,
      personaReinforcement,
      outputGuard,
    };
  } catch {
    // Fallback to minimal guidance
    return buildMinimalGuidanceFallback(sceneContext);
  }
}

/**
 * Check if an input should be classified as direct user reply.
 *
 * Classification criteria:
 * - Trigger source is user_reply
 * - Not a platform comment/reply
 * - Not an explicit task delegation
 */
export function isDirectUserReply(input: {
  triggerSource: string;
  isPlatformReply: boolean;
  isExplicitTask: boolean;
}): boolean {
  return (
    input.triggerSource === "user_reply" &&
    !input.isPlatformReply &&
    !input.isExplicitTask
  );
}
