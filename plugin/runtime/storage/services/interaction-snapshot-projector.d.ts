/**
 * InteractionSnapshotProjector — T-SMS.C.4
 *
 * Core logic: Redact recent conversation into summary-only snapshots.
 * No raw private message content stored — only summary + contentRef.
 * DR-022: raw private content rejected by WriteValidationGate upstream.
 *
 * Dependencies: session_chronicle table (existing v6 schema)
 */
import type { StateDatabase } from "../db/index.js";
import type { RecentInteractionSnapshot } from "../../shared/types/v7-entities.js";
export interface InteractionSnapshotProjector {
    loadRecentInteractionSnapshot(limit?: number): Promise<RecentInteractionSnapshot[]>;
}
export declare function createInteractionSnapshotProjector(database: StateDatabase): InteractionSnapshotProjector;
