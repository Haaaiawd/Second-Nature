/**
 * CharacterFrameBuilder — Build a source-backed, contestable CharacterFrame
 * from normalized CharacterRefreshInput.
 *
 * Core logic: aggregate five postures from CharacterSignals, validate with
 * FrameSourceValidator, auto-supersede previous accepted frame, and mark the
 * new frame accepted with newlyProposed metadata.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/character-continuity-system.md §5.1`
 * - `.anws/v9/04_SYSTEM_DESIGN/character-continuity-system.detail.md §3.1 §3.3 §3.5`
 * - `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md §5`
 *
 * Dependencies:
 * - `src/shared/types/v9-contracts.js`
 * - `src/core/second-nature/character/frame-source-validator.js`
 *
 * Boundary:
 * - No LLM-based personality inference; rules-only aggregation and summarization.
 * - Returns deferred result if validation fails or sources are insufficient.
 * - Auto-accepts validated frames but leaves first-injection contestability to
 *   the projection adapter (T7.2.2).
 *
 * Test coverage: tests/unit/character/v9-character-frame-builder.test.ts
 */
import type { CharacterFrame, CharacterFrameStatus, CharacterRefreshInput } from "../../../shared/types/v9-contracts.js";
import type { CharacterFrameDeferredResult } from "./character-refresh-input-normalizer.js";
import { FrameSourceValidator } from "./frame-source-validator.js";
export interface CharacterFrameStorePort {
    readLatestAcceptedFrame(): Promise<CharacterFrame | null>;
    readFrameById(id: string): Promise<CharacterFrame | null>;
    writeCandidateFrame(frame: CharacterFrame): Promise<void>;
    updateFrameLifecycle(frameId: string, status: CharacterFrameStatus, opts?: {
        supersededBy?: string;
        successorFrameId?: string;
        validUntil?: string;
        revisionOf?: string | null;
        acceptedAt?: string;
        charCount?: number;
    }): Promise<void>;
    nextVersion?(): Promise<number>;
}
export interface AcceptedCharacterFrameResult {
    kind: "accepted";
    frame: CharacterFrame;
}
export type CharacterFrameResult = AcceptedCharacterFrameResult | CharacterFrameDeferredResult;
export interface BuildCharacterFrameOptions {
    now?: string;
    validator?: FrameSourceValidator;
}
export declare function refreshCharacterFrame(input: CharacterRefreshInput, store: CharacterFrameStorePort, options?: BuildCharacterFrameOptions): Promise<CharacterFrameResult>;
