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
import type { SqlValue } from "sql.js";
import type {
  RestoreSnapshot,
  RestorableEntityKind,
  SensitiveExcludedKind,
} from "../../shared/types/v7-entities.js";

const ALL_RESTORABLE_KINDS: readonly RestorableEntityKind[] = [
  "identity_profile",
  "agent_goal",
  "tool_experience",
  "daily_diary",
  "dream_output",
  "narrative_timeline",
];

const TABLE_BY_KIND: Record<RestorableEntityKind, string> = {
  identity_profile: "identity_profile",
  agent_goal: "agent_goal",
  tool_experience: "tool_experience",
  daily_diary: "daily_diary_index",
  dream_output: "dream_output_index",
  narrative_timeline: "narrative_timeline",
};

const DEFAULT_EXCLUDED_KINDS: readonly SensitiveExcludedKind[] = [
  "credential",
  "raw_private_message",
  "raw_prompt",
  "encryption_key",
  "session_token",
];

const DEFAULT_RETENTION_COUNT = 3;

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

function safeParseJson<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

function parseSnapshotRow(
  cols: string[],
  row: unknown[],
): RestoreSnapshot {
  const get = (name: string) => row[cols.indexOf(name)] as string | null;
  return {
    snapshotId: get("snapshot_id")!,
    entityWhitelist: safeParseJson<RestorableEntityKind[]>(
      (get("entity_whitelist_json") as string) ?? "[]",
      [],
    ),
    excludedSensitiveKinds: safeParseJson<SensitiveExcludedKind[]>(
      (get("excluded_sensitive_kinds_json") as string) ?? "[]",
      [],
    ),
    capturedAt: get("captured_at")!,
    payload: safeParseJson<Record<string, unknown>>(
      (get("payload_json") as string) ?? "{}",
      {},
    ),
  };
}

export function createRestoreSnapshotStore(
  database: StateDatabase,
  options: { retentionCount?: number } = {},
): RestoreSnapshotStore {
  const { sqlite } = database;
  const retentionCount = options.retentionCount ?? DEFAULT_RETENTION_COUNT;

  function trimOldSnapshots(): void {
    const countResult = sqlite.exec(
      `SELECT COUNT(*) as cnt FROM restore_snapshot`,
    );
    if (
      countResult.length === 0 ||
      countResult[0]!.values.length === 0
    ) {
      return;
    }
    const total = (countResult[0]!.values[0]![0] as number) ?? 0;
    if (total <= retentionCount) return;

    const toDelete = total - retentionCount;
    sqlite.exec(
      `DELETE FROM restore_snapshot
       WHERE snapshot_id IN (
         SELECT snapshot_id FROM restore_snapshot
         ORDER BY captured_at ASC
         LIMIT ${toDelete}
       )`,
    );
  }

  return {
    async captureSnapshot(input) {
      const whitelist =
        input.entityWhitelist && input.entityWhitelist.length > 0
          ? input.entityWhitelist.filter((k) =>
              ALL_RESTORABLE_KINDS.includes(k),
            )
          : [...ALL_RESTORABLE_KINDS];

      const excluded = [...DEFAULT_EXCLUDED_KINDS];
      const capturedAt = input.capturedAt ?? new Date().toISOString();

      sqlite.run(
        `INSERT INTO restore_snapshot
         (snapshot_id, entity_whitelist_json, excluded_sensitive_kinds_json, captured_at, payload_json)
         VALUES (?, ?, ?, ?, ?)`,
        [
          input.snapshotId,
          JSON.stringify(whitelist),
          JSON.stringify(excluded),
          capturedAt,
          JSON.stringify(input.payload),
        ],
      );

      trimOldSnapshots();

      return {
        snapshotId: input.snapshotId,
        entityWhitelist: whitelist,
        excludedSensitiveKinds: [...excluded],
        capturedAt,
        payload: input.payload,
      };
    },

    async loadLatestSnapshot() {
      const result = sqlite.exec(
        `SELECT * FROM restore_snapshot
         ORDER BY captured_at DESC
         LIMIT 1`,
      );
      if (result.length === 0 || result[0]!.values.length === 0) {
        return undefined;
      }
      return parseSnapshotRow(result[0]!.columns, result[0]!.values[0]!);
    },

    async listSnapshots(limit = 10) {
      const result = sqlite.exec(
        `SELECT * FROM restore_snapshot
         ORDER BY captured_at DESC
         LIMIT ${limit}`,
      );
      if (result.length === 0 || result[0]!.values.length === 0) {
        return [];
      }
      return result[0]!.values.map((row) =>
        parseSnapshotRow(result[0]!.columns, row),
      );
    },

    async applyBoundedRestore(input) {
      const warnings: string[] = [];
      const completedEntities: string[] = [];
      const failedEntities: string[] = [];

      // 1. Find matching snapshot by exact id, then fallback to latest
      let snapshot: RestoreSnapshot | undefined;
      const exactMatch = sqlite.exec(
        `SELECT * FROM restore_snapshot WHERE snapshot_id = ? LIMIT 1`,
        [input.restoreTarget],
      );
      if (
        exactMatch.length > 0 &&
        exactMatch[0]!.values.length > 0
      ) {
        snapshot = parseSnapshotRow(
          exactMatch[0]!.columns,
          exactMatch[0]!.values[0]!,
        );
      } else {
        const latestResult = sqlite.exec(
          `SELECT * FROM restore_snapshot ORDER BY captured_at DESC LIMIT 1`,
        );
        if (
          latestResult.length > 0 &&
          latestResult[0]!.values.length > 0
        ) {
          snapshot = parseSnapshotRow(
            latestResult[0]!.columns,
            latestResult[0]!.values[0]!,
          );
        }
      }

      if (!snapshot) {
        return {
          ok: false,
          completedEntities: [],
          failedEntities: [input.restoreTarget],
          warnings: ["snapshot_not_found"],
        };
      }

      const whitelist =
        input.entityWhitelist && input.entityWhitelist.length > 0
          ? input.entityWhitelist.filter((k) =>
              ALL_RESTORABLE_KINDS.includes(k),
            )
          : [...snapshot.entityWhitelist];

      for (const kind of whitelist) {
        // Never restore sensitive kinds (DR-017)
        if (
          DEFAULT_EXCLUDED_KINDS.includes(
            kind as unknown as SensitiveExcludedKind,
          )
        ) {
          warnings.push(`skipped_sensitive_kind:${kind}`);
          continue;
        }

        const kindData = snapshot.payload[kind];
        if (!kindData) {
          // Snapshot whitelist includes this kind but payload has no data for it.
          // This is not a failure — the entity simply had no state at capture time.
          warnings.push(`payload_missing:${kind}`);
          continue;
        }

        try {
          const rows = Array.isArray(kindData) ? kindData : [kindData];
          if (rows.length === 0) {
            warnings.push(`empty_payload:${kind}`);
            continue;
          }

          for (const row of rows) {
            if (!row || typeof row !== "object") continue;
            const keys = Object.keys(row as Record<string, unknown>);
            if (keys.length === 0) continue;
            const columns = keys.join(", ");
            const placeholders = keys.map(() => "?").join(", ");
            const values = keys.map(
              (k) => (row as Record<string, unknown>)[k],
            ) as SqlValue[];
            const table = TABLE_BY_KIND[kind];
            sqlite.run(
              `INSERT OR REPLACE INTO ${table} (${columns}) VALUES (${placeholders})`,
              values,
            );
          }

          completedEntities.push(kind);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          warnings.push(`restore_failed:${kind}:${msg}`);
          failedEntities.push(kind);
        }
      }

      return {
        ok: failedEntities.length === 0,
        completedEntities,
        failedEntities,
        warnings,
      };
    },
  };
}
