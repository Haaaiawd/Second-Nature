/**
 * CharacterRefreshInputNormalizer — Normalize raw signals into canonical
 * `CharacterRefreshInput` and reject raw private/prompt/credential payloads.
 *
 * Core logic: upstream systems provide redacted summaries and source refs.
 * This module enforces the input boundary before posture extraction.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/character-continuity-system.md §5.1`
 * - `.anws/v9/04_SYSTEM_DESIGN/character-continuity-system.detail.md §2.4 §3.0`
 * - `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md §5.4`
 *
 * Dependencies:
 * - `src/shared/types/v9-contracts.js` (CharacterRefreshInput, CharacterSignal, SourceRef)
 *
 * Boundary:
 * - Rejects empty signals or missing source refs.
 * - Rejects disallowed source families.
 * - Rejects raw private/prompt/credential redaction classes.
 * - Does not generate posture text; only canonicalizes input.
 *
 * Test coverage: tests/unit/character/v9-character-refresh-input-normalizer.test.ts
 */
import type { CharacterRefreshInput, CharacterSignal, SourceRef, SourceRefFamily } from "../../../shared/types/v9-contracts.js";
export interface CharacterRefreshContext {
    refreshId: string;
    workspaceRoot: string;
    trigger: CharacterRefreshInput["trigger"];
    now?: string;
}
export interface CharacterFrameDeferredResult {
    kind: "deferred";
    reason: "character_frame_insufficient_sources" | "character_refresh_input_invalid" | "character_refresh_input_redacted";
    sourceRefs: SourceRef[];
    violations?: string[];
}
export type CharacterRefreshInputResult = CharacterRefreshInput | CharacterFrameDeferredResult;
export declare const CHARACTER_SIGNAL_ALLOWED_SOURCE_FAMILIES: ReadonlySet<SourceRefFamily>;
export declare function normalizeCharacterRefreshInput(rawSignals: CharacterSignal[], context: CharacterRefreshContext): CharacterRefreshInputResult;
