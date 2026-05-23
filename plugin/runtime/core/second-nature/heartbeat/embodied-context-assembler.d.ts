/**
 * EmbodiedContextAssembler — T-CP.C.1
 *
 * Core logic: Assembles a complete EmbodiedContext from up to 7 read ports:
 * - 5 state-memory slices via EmbodiedContextStatePort
 * - affordanceMap via AffordanceAssembler
 * - selfHealth via SelfHealthProvider (observability hook)
 *
 * Trim policies (DR-020):
 * - recentInteractions: LIFO 10
 * - toolExperience: LIFO 10
 * - sourceRefs: deduplicated to 20 per slice
 *
 * Performance: P95 < 400ms for full assembly (DR-016).
 *
 * Dependencies:
 * - `EmbodiedContextStatePort` from `../../../storage/services/embodied-context-state-port.js`
 * - `AffordanceAssembler` from `../body/tool-affordance/affordance-assembler.js`
 * - `EmbodiedContext` from `../../../shared/types/v7-entities.js`
 *
 * Boundary:
 * - Candidate dream outputs are NOT included (DR-011).
 * - Each slice gets its own loaded/degraded/blocked status.
 * - Does NOT throw on partial failure; assembles best-effort context.
 *
 * Test coverage: tests/unit/control-plane/embodied-context-assembler.test.ts
 */
import type { EmbodiedContextStatePort } from "../../../storage/services/embodied-context-state-port.js";
import type { AffordanceAssembler } from "../body/tool-affordance/affordance-assembler.js";
import type { EmbodiedContext, SelfHealthSnapshot } from "../../../shared/types/v7-entities.js";
export interface SelfHealthProvider {
    loadSelfHealth(): Promise<{
        status: "loaded";
        data: SelfHealthSnapshot;
    } | {
        status: "degraded";
        reason: string;
    }>;
}
export interface EmbodiedContextAssemblerDeps {
    statePort: EmbodiedContextStatePort;
    affordanceAssembler: AffordanceAssembler;
    selfHealthProvider?: SelfHealthProvider;
    options?: {
        interactionLimit?: number;
        experienceLimit?: number;
        sourceRefLimit?: number;
        profileId?: string;
    };
}
export interface EmbodiedContextAssembler {
    assembleEmbodiedContext(): Promise<EmbodiedContext>;
}
export declare function createEmbodiedContextAssembler(deps: EmbodiedContextAssemblerDeps): EmbodiedContextAssembler;
