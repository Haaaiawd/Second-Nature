/**
 * V9EmbodiedContextAssembler — T2.2.1
 *
 * Core logic: Assemble a complete v9 EmbodiedContext from:
 * - v8 state-memory slices (identity, goals, recentInteractions, toolExperience, acceptedDream)
 * - affordanceMap via AffordanceAssembler
 * - selfHealth via SelfHealthProvider
 * - v9 continuity slices (selfContinuityCard, activeMemoryProjections, activeProceduralProjections, routineList)
 * - character slices (characterFramePointer, characterFrameProjection)
 * - activityThreads via ActivityThreadPort
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/control-context-system.md §5.1`
 * - `.anws/v9/04_SYSTEM_DESIGN/control-context-system.detail.md §2 §3.3 §3.5`
 * - `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md §10`
 * - ADR-006: Character Continuity as Emergent Projection
 *
 * Dependencies:
 * - `src/storage/services/embodied-context-state-port.js`
 * - `src/core/second-nature/body/tool-affordance/affordance-assembler.js`
 * - `src/core/second-nature/memory/self-continuity-card-assembler.js`
 * - `src/core/second-nature/character/character-frame-lifecycle.js`
 * - `src/storage/v9-state-stores.js`
 * - `src/shared/types/v9-contracts.js`
 *
 * Boundary:
 * - Each slice gets its own loaded/degraded/blocked status.
 * - Does NOT throw on partial failure; assembles best-effort context.
 * - CharacterFrame projection is contestable; pointer and projection are loaded separately.
 * - Activity threads are loaded for active and paused statuses.
 * - acceptedDream is mapped from v7 DreamOutput[] to v9 MemoryProjection[].
 *
 * Test coverage:
 * - `tests/unit/control-plane/v9-embodied-context.test.ts`
 * - `tests/integration/v9/context-continuity-injection.test.ts`
 */
import type { EmbodiedContextStatePort } from "../../../storage/services/embodied-context-state-port.js";
import type { AffordanceAssembler } from "../body/tool-affordance/affordance-assembler.js";
import type { SelfHealthSnapshot } from "../../../shared/types/v7-entities.js";
import type { ActivityThread, CharacterFramePointer, ContinuityReadPort, ContinuityScope, EmbodiedContext, EmbodiedContextCharacterProjection } from "../../../shared/types/v9-contracts.js";
import type { StateDatabase } from "../../../storage/db/index.js";
export interface SelfHealthProvider {
    loadSelfHealth(): Promise<{
        status: "loaded";
        data: SelfHealthSnapshot;
    } | {
        status: "degraded";
        reason: string;
    }>;
}
export interface CharacterLoaderPort {
    loadActiveCharacterFrame(scope: ContinuityScope): Promise<{
        pointer?: CharacterFramePointer;
        projection?: EmbodiedContextCharacterProjection;
        degraded?: {
            reason: string;
            code: string;
        };
    }>;
}
export interface ActivityThreadPort {
    loadActivityThreads(options: {
        workspaceRoot: string;
        status: ("active" | "paused")[];
        limit: number;
    }): Promise<{
        threads: ActivityThread[];
        degraded?: {
            reason: string;
            code: string;
        };
    }>;
}
export interface V9EmbodiedContextAssemblerDeps {
    statePort: EmbodiedContextStatePort;
    affordanceAssembler: AffordanceAssembler;
    selfHealthProvider?: SelfHealthProvider;
    continuityReadPort: ContinuityReadPort;
    characterLoader: CharacterLoaderPort;
    activityThreadPort: ActivityThreadPort;
    options?: {
        interactionLimit?: number;
        experienceLimit?: number;
        acceptedDreamLimit?: number;
        activityThreadLimit?: number;
        hardDeadlineMs?: number;
    };
}
export interface V9EmbodiedContextAssembler {
    assembleEmbodiedContext(): Promise<EmbodiedContext>;
}
export declare function createCharacterLoaderPort(db: StateDatabase): CharacterLoaderPort;
export declare function createActivityThreadPort(db: StateDatabase): ActivityThreadPort;
export declare function createV9EmbodiedContextAssembler(deps: V9EmbodiedContextAssemblerDeps): V9EmbodiedContextAssembler;
export interface V9EmbodiedContextAssemblerFactoryDeps {
    db: StateDatabase;
    statePort: EmbodiedContextStatePort;
    affordanceAssembler: AffordanceAssembler;
    selfHealthProvider?: SelfHealthProvider;
    continuityReadPort: ContinuityReadPort;
}
export declare function createV9EmbodiedContextAssemblerFromDeps(deps: V9EmbodiedContextAssemblerFactoryDeps): V9EmbodiedContextAssembler;
