/**
 * FrameSourceValidator — Check CharacterFrame text for forbidden identity-lock,
 * emotion-claim, personality-score and hard-control patterns.
 *
 * Core logic: scan serialized frame text for scoped rule violations while
 * allowing safe counterexamples (security policy wording, context-reader labels).
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/character-continuity-system.detail.md §3.4`
 * - `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md §3.6`
 *
 * Dependencies: `src/shared/types/v9-contracts.js`
 *
 * Boundary:
 * - Returns rule IDs, not boolean; each violation carries location path.
 * - Checks every posture + contestPrompt + habit/tension text.
 * - Does not rewrite text; caller decides deferred/allowed.
 *
 * Test coverage: tests/unit/character/v9-character-frame-builder.test.ts
 */
import type { CharacterFrame } from "../../../shared/types/v9-contracts.js";
export type FrameSourceRule = "emotion_assertion" | "personality_score" | "personality_label" | "hard_control_rule" | "empty_source_posture" | "source_count_below_minimum" | "contest_prompt_contains_assertion";
export interface FrameSourceViolation {
    rule: FrameSourceRule;
    matchedText: string;
    location: string;
}
export interface FrameValidationResult {
    ok: boolean;
    violations: FrameSourceViolation[];
}
export declare const MIN_SOURCE_REFS_PER_POSTURE = 1;
export declare class FrameSourceValidator {
    validate(frame: CharacterFrame): FrameValidationResult;
}
