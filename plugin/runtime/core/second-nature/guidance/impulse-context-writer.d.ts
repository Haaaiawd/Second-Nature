/**
 * ImpulseContextWriter — Persist assembled impulse + atmosphere as agent-facing artifact.
 *
 * Core logic: Convert impulse assembly result into a durable artifact that can be
 * read during setup, heartbeat, and platform-scene entry without re-assembly.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/guidance-voice-system.md §1`
 * - `docs/validation/openclaw-plugin-classification.md §5`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (writeImpulseContextArtifact)
 * - `src/guidance/impulse-assembler.js` (ImpulseAssemblerResult)
 *
 * Boundary:
 * - Does NOT register a fake OpenClaw context-engine.
 * - Does NOT claim delivery or decision capability.
 * - Overwrites existing artifact for same scene/capability combo (upsert behavior).
 */
import type { StateDatabase } from "../../../storage/db/index.js";
import type { ImpulseAssemblerResult } from "../../../guidance/impulse-assembler.js";
import type { SourceRef, DegradedOperationResult } from "../../../shared/types/v8-contracts.js";
export interface ImpulseContextArtifactInput {
    sceneType: string;
    capabilityIntent?: string;
    platformId?: string;
    impulseResult: ImpulseAssemblerResult;
    atmosphereText?: string;
    expressionBoundaryConstraints: string[];
    expressionBoundaryStyle?: string;
}
export interface WriteArtifactResult {
    id: string;
    freshnessVersion: number;
}
export declare function writeImpulseContext(db: StateDatabase, input: ImpulseContextArtifactInput, options?: {
    now?: string;
    sourceRefs?: SourceRef[];
}): Promise<WriteArtifactResult | DegradedOperationResult>;
