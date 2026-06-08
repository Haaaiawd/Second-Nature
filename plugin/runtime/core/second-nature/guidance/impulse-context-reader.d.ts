/**
 * ImpulseContextReader — Read agent-facing impulse context artifact from state.
 *
 * Core logic: Retrieve the latest persisted artifact for a given scene/capability
 * combo, with freshness diagnostics and explicit missing-artifact reasons.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/guidance-voice-system.md §1`
 * - `docs/validation/openclaw-plugin-classification.md §5`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (readImpulseContextArtifact)
 *
 * Boundary:
 * - Does NOT fall back to real-time assembly; returns missing reason when absent.
 * - Does NOT register a fake OpenClaw context-engine.
 */
import type { StateDatabase } from "../../../storage/db/index.js";
export interface ImpulseContextArtifactView {
    id: string;
    sceneType: string;
    capabilityIntent: string | null;
    platformId: string | null;
    capabilityClass: string | null;
    impulseSource: string;
    impulseText: string | null;
    atmosphereText: string | null;
    expressionBoundaryConstraints: string[];
    expressionBoundaryStyle: string | null;
    freshnessVersion: number;
    createdAt: string;
    updatedAt: string;
}
export interface MissingArtifactReason {
    available: false;
    reason: "artifact_not_persisted" | "artifact_expired" | "state_unreadable" | "scene_capability_mismatch";
    operatorNextAction: string;
}
export type ReadImpulseContextResult = {
    available: true;
    artifact: ImpulseContextArtifactView;
    freshnessMs: number;
} | MissingArtifactReason;
export declare function readImpulseContext(db: StateDatabase, sceneType: string, capabilityIntent?: string, platformId?: string): Promise<ReadImpulseContextResult>;
