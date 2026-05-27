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
import type { GuidanceFallback, GuidancePayload } from "../../../guidance/index.js";
import type { PersonaCandidate } from "../../../guidance/index.js";
/**
 * Scene context for user reply - uses a distinct scene type
 * to avoid confusion with platform reply scene.
 */
export declare const USER_REPLY_SCENE_TYPE: "user_reply";
export type UserReplySceneType = typeof USER_REPLY_SCENE_TYPE;
/**
 * Build very light continuity guidance for direct user replies.
 *
 * Returns a minimal guidance payload with:
 * - Light atmosphere (continuity-focused)
 * - NO impulses (unlike platform reply scene)
 * - Optional persona reinforcement (1-2 snippets max)
 * - Minimal expression boundary (tone consistency only)
 */
export declare function buildLightReplyContinuity(input: {
    replyContext: {
        recentTone?: string;
        lastInteractionSummary?: string;
    };
    personaCandidates?: PersonaCandidate[];
}): Promise<GuidancePayload | GuidanceFallback>;
/**
 * Check if an input should be classified as direct user reply.
 *
 * Classification criteria:
 * - Trigger source is user_reply
 * - Not a platform comment/reply
 * - Not an explicit task delegation
 */
export declare function isDirectUserReply(input: {
    triggerSource: string;
    isPlatformReply: boolean;
    isExplicitTask: boolean;
}): boolean;
