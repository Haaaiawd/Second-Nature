/**
 * RestoreSnapshotStore — T-SMS.C.6
 *
 * Core logic: Capture entity snapshots with a whitelist of 6 restorable kinds.
 * Automatically excludes sensitive kinds (credential, raw_private_message,
 * raw_prompt, encryption_key, session_token) per DR-017. Retains only the
 * most recent 3 snapshots by default.
 *
 * Dependencies:
 * - `StateDatabase` from `../db/index.js`
 * - `RestoreSnapshot`, `RestorableEntityKind`, `SensitiveExcludedKind`
 *   from `../../shared/types/v7-entities.js`
 *
 * Boundary:
 * - `captureSnapshot` silently drops any requested sensitive kinds.
 * - `loadLatestSnapshot` returns the most recent capture.
 * - `listSnapshots` orders by `captured_at` descending.
 *
 * Test coverage: tests/unit/storage/restore-snapshot-store.test.ts
 */
import type { StateDatabase } from "../db/index.js";
import type { RestoreSnapshot, RestorableEntityKind } from "../../shared/types/v7-entities.js";
export interface RestoreSnapshotStore {
    captureSnapshot(input: {
        snapshotId: string;
        entityWhitelist?: RestorableEntityKind[];
        payload: Record<string, unknown>;
        capturedAt?: string;
    }): Promise<RestoreSnapshot>;
    loadLatestSnapshot(): Promise<RestoreSnapshot | undefined>;
    listSnapshots(limit?: number): Promise<RestoreSnapshot[]>;
    /**
     * Apply a bounded restore from a captured snapshot.
     * Loads the matching snapshot (by restoreTarget id, or latest fallback),
     * then attempts to write each whitelisted entity back into its table.
     * Sensitive kinds are always skipped. Never restores credential fields.
     */
    applyBoundedRestore(input: {
        restoreTarget: string;
        fromVersion: string;
        toVersion: string;
        entityWhitelist?: RestorableEntityKind[];
    }): Promise<{
        ok: boolean;
        completedEntities: string[];
        failedEntities: string[];
        warnings: string[];
    }>;
}
export declare function createRestoreSnapshotStore(database: StateDatabase, options?: {
    retentionCount?: number;
}): RestoreSnapshotStore;
