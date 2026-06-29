/**
 * v9 DreamConsolidationRunner — T5.2.1 output family routing.
 *
 * Core logic: Extend v8 dream consolidation to emit candidates across v9
 * output families:
 *   - memory          → long-term memory projection candidates
 *   - procedural      → ToolRoutine / capability-pattern candidates
 *   - self_continuity → SelfContinuityCard refresh signals
 *   - connector_evolution → ConnectorEvolutionPlan candidates
 *   - character       → CharacterFrame refresh hints
 *
 * The runner only generates and validates candidates; it does not accept or
 * install projections/routines/plans. Callers own acceptance via lifecycle
 * ports (acceptMemoryProjection, acceptProceduralProjection, etc.).
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/memory-continuity-system.md §5.1`
 * - `.anws/v9/04_SYSTEM_DESIGN/memory-continuity-system.detail.md §3.3`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (readDreamConsolidationRunById, readQuietDailyReviewById)
 * - `src/storage/v9-state-stores.js` (optional persistence for candidate ids)
 * - `src/shared/types/v8-contracts.js` (SourceRef, DegradedOperationResult, V8ReasonCode)
 * - `src/shared/types/v9-contracts.js` (SourceRef as canonical v9 shape)
 *
 * Boundary:
 * - Rules-only candidate generation; no model assist.
 * - Does not accept/reject projections.
 * - Redaction gate blocks sensitive private content and credential shapes.
 *
 * Test coverage:
 * - tests/unit/dream/v9-dream-output-families.test.ts
 * - tests/integration/v9/quiet-dream-continuity.test.ts
 */
import type { StateDatabase } from "../../../storage/db/index.js";
import type { SourceRef } from "../../../shared/types/v9-contracts.js";
import type { DegradedOperationResult, V8ReasonCode } from "../../../shared/types/v8-contracts.js";
export type DreamOutputFamily = "memory" | "procedural" | "self_continuity" | "connector_evolution" | "character";
export interface DreamOutputCandidate {
    id: string;
    runId: string;
    reviewId: string;
    family: DreamOutputFamily;
    candidateText: string;
    sourceRefs: SourceRef[];
    confidence: number;
    validationStatus: "valid" | "rejected" | "blocked";
    validationReason?: string;
    topicKey?: string;
    capabilityPattern?: string;
    platformId?: string;
    planType?: string;
}
export interface RunV9DreamConsolidationResult {
    runId: string;
    status: "completed" | "failed" | "blocked";
    candidates: DreamOutputCandidate[];
    reason?: V8ReasonCode;
    outputFamilies: DreamOutputFamily[];
}
export interface RunV9DreamConsolidationOptions {
    now?: string;
}
export declare function runV9DreamConsolidation(db: StateDatabase, runId: string, options?: RunV9DreamConsolidationOptions): Promise<RunV9DreamConsolidationResult | DegradedOperationResult>;
