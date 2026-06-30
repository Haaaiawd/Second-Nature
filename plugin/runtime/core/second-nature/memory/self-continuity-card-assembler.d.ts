/**
 * SelfContinuityCardAssembler — Build bounded `SelfContinuityCard` from active
 * memory projections, procedural projections, routines, and CharacterFrame pointer.
 *
 * Core logic:
 * - Read active projections/routines and accepted CharacterFrame pointer.
 * - Assemble canonical section ordering per shared-v9-contracts.md §4.
 * - Serialize to bounded `cardText` (≤1200 UTF-8 bytes), preserving summary
 *   and characterFramePointer under truncation.
 * - Persist the card via `writeSelfContinuityCard` and return runtime shape.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/memory-continuity-system.md §5.1`
 * - `.anws/v9/04_SYSTEM_DESIGN/memory-continuity-system.detail.md §3.7`
 * - `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md §4`
 * - `.anws/v9/04_SYSTEM_DESIGN/control-context-system.detail.md §2.2 / §3.4`
 *
 * Dependencies:
 * - `src/shared/types/v9-contracts.js`
 * - `src/storage/v9-state-stores.js` (procedural/tool_routine/self_continuity_card)
 * - `src/storage/v8-state-stores.js` (memory projections)
 * - `src/core/second-nature/character/character-frame-lifecycle.js` (pointer loader)
 *
 * Boundary:
 * - Rules-only assembly; no LLM summarization.
 * - Returns `continuity_unavailable` degraded result when no active data.
 * - CharacterFrame full projection is NOT included; only short pointer.
 * - All source refs deduplicated and carried for traceability.
 *
 * Test coverage:
 * - `tests/unit/memory/v9-self-continuity-card.test.ts`
 * - `tests/integration/v9/self-continuity-card-read.test.ts`
 */
import type { ContinuityReadPort, ContinuityScope, DegradedOperationResult, SelfContinuityCard } from "../../../shared/types/v9-contracts.js";
import type { StateDatabase } from "../../../storage/db/index.js";
import type { CharacterFrameStorePort } from "../character/character-frame-lifecycle.js";
export declare function countChars(text: string): number;
export declare function truncateToChars(text: string, maxChars: number): string;
export declare function createCharacterFrameStoreAdapter(db: StateDatabase): Promise<CharacterFrameStorePort>;
export interface AssembleSelfContinuityCardResult {
    card: SelfContinuityCard;
    persistedId: string;
}
export declare function assembleSelfContinuityCard(db: StateDatabase, scope: ContinuityScope): Promise<AssembleSelfContinuityCardResult | DegradedOperationResult>;
export declare function createContinuityReadPort(db: StateDatabase): ContinuityReadPort;
