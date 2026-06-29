/**
 * CharacterFrameLifecycle — Contest/re-authoring state machine and projection
 * adapter for CharacterFrame.
 *
 * Core logic:
 * - Apply accept/reject/revise/retire actions with a transition matrix.
 * - Build bounded `EmbodiedContextCharacterProjection` from an accepted frame.
 * - Build `CharacterFramePointer` for SelfContinuityCard injection.
 * - Mark first injection as `newlyProposed` until Agent contests or accepts.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/character-continuity-system.md §5.1 §6.1`
 * - `.anws/v9/04_SYSTEM_DESIGN/character-continuity-system.detail.md §2.1 §3.2 §3.3 §4.2 §4.3`
 * - `.anws/v9/04_SYSTEM_DESIGN/control-context-system.detail.md §3.5`
 * - `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md §5`
 *
 * Dependencies:
 * - `src/shared/types/v9-contracts.js`
 * - `src/core/second-nature/character/character-frame-builder.js`
 *
 * Boundary:
 * - `contested` is not a CharacterFrame status; it is a runtime pointer/projection
 *   status owned by `control-context-system`.
 * - Only `accepted` frames can be projected as `active`.
 * - `newlyProposed` is a projection/pointer flag, not a frame status.
 * - Revision creates a new `candidate` frame linked to the original; the original
 *   stays `accepted` until the revision is accepted.
 * - Supersede sets the previous accepted frame to `superseded` with `validUntil`.
 *
 * Test coverage:
 * - `tests/unit/character/v9-character-lifecycle.test.ts`
 * - `tests/integration/v9/character-context-projection.test.ts`
 */
import type { CharacterContestAction, CharacterContestResult, CharacterFrame, CharacterFramePointer, CharacterFrameStatus, EmbodiedContextCharacterProjection } from "../../../shared/types/v9-contracts.js";
export interface CharacterFrameStorePort {
    readFrameById(id: string): Promise<CharacterFrame | null>;
    readLatestAcceptedFrame(): Promise<CharacterFrame | null>;
    readPendingRevisionFor(frameId: string): Promise<CharacterFrame | null>;
    writeCandidateFrame(frame: CharacterFrame): Promise<void>;
    updateFrameLifecycle(frameId: string, status: CharacterFrameStatus, opts?: {
        supersededBy?: string;
        successorFrameId?: string;
        validUntil?: string;
        revisionOf?: string | null;
        acceptedAt?: string;
        charCount?: number;
        payloadJson?: string;
    }): Promise<void>;
}
export interface BuildProjectionOptions {
    pointerStatus?: CharacterFramePointer["status"];
    newlyProposed?: boolean;
}
export interface ProjectionWithPointer {
    pointer: CharacterFramePointer;
    projection: EmbodiedContextCharacterProjection;
}
export declare function applyCharacterContest(frameId: string, action: CharacterContestAction, store: CharacterFrameStorePort, options?: {
    reason?: string;
    now?: string;
}): Promise<CharacterContestResult>;
export declare function supersedeFrame(previousId: string, newFrameId: string, store: CharacterFrameStorePort, options?: {
    now?: string;
}): Promise<CharacterContestResult>;
export declare function buildCharacterFramePointer(frame: CharacterFrame, opts?: BuildProjectionOptions): CharacterFramePointer;
export declare function buildEmbodiedContextProjection(frame: CharacterFrame, opts?: BuildProjectionOptions): EmbodiedContextCharacterProjection;
export declare function buildCharacterProjectionPair(frame: CharacterFrame, opts?: BuildProjectionOptions): ProjectionWithPointer;
export interface LoadActiveCharacterFrameResult {
    frame?: CharacterFrame;
    pointer?: CharacterFramePointer;
    projection?: EmbodiedContextCharacterProjection;
    reason?: string;
}
export declare function loadActiveCharacterFrame(store: CharacterFrameStorePort, options?: {
    now?: string;
    isFirstInjection?: boolean;
    contestedFrameId?: string;
}): Promise<LoadActiveCharacterFrameResult>;
export declare function markFirstInjectionSeen(store: CharacterFrameStorePort, frameId: string, now?: string): Promise<void>;
