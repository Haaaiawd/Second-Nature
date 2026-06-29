/**
 * ContextSerializer — T2.2.1
 *
 * Core logic: Render `EmbodiedContext` into a Claw-facing prompt slice with
 * contestable-projection markers and Agent-boundary forbidden-pattern checks.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/control-context-system.md §5.1 §9.3`
 * - `.anws/v9/04_SYSTEM_DESIGN/control-context-system.detail.md §3.10`
 * - `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md §3.6`
 * - ADR-006: Character Continuity as Emergent Projection
 *
 * Boundary:
 * - Slices are rendered in separate sections; never merged into a single
 *   "you must act" system command.
 * - Character projection is prefixed with a contestable marker.
 * - Newly proposed frames are explicitly labeled as candidates.
 * - Forbidden patterns are detected per section. When a section contains a
 *   hard-control / emotion-claim / identity-lock pattern, that section is
 *   replaced with a `[blocked: <ruleId>]` marker in the output text.
 * - Does NOT redact credentials; input slices are assumed already redacted.
 *
 * Test coverage:
 * - `tests/unit/control-plane/v9-embodied-context.test.ts`
 * - `tests/integration/v9/context-continuity-injection.test.ts`
 */
import type { EmbodiedContext } from "../../../shared/types/v9-contracts.js";
export type ForbiddenRuleId = "emotion_claim" | "identity_lock" | "hard_control";
export interface SerializedContext {
    text: string;
    sections: string[];
    forbiddenPatternWarnings: ForbiddenPatternWarning[];
    isBlocked: boolean;
    blockedReasons: ForbiddenRuleId[];
}
export interface ForbiddenPatternWarning {
    section: string;
    ruleId: ForbiddenRuleId;
    snippet: string;
}
export declare function serializeEmbodiedContext(context: EmbodiedContext): SerializedContext;
