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

export function createInteractionSnapshotProjector(
  database: StateDatabase,
): InteractionSnapshotProjector {
  const { sqlite } = database;

  return {
    async loadRecentInteractionSnapshot(limit = 10) {
      const result = sqlite.exec(
        `SELECT entry_id, actor, summary, result, occurred_at,
                source_refs_json, related_decision_id
         FROM session_chronicle
         WHERE event_kind IN ('interaction', 'owner_reply', 'outreach_sent')
         ORDER BY occurred_at DESC
         LIMIT ${limit}`,
      );

      if (result.length === 0 || result[0]!.values.length === 0) return [];

      const cols = result[0]!.columns;
      const get = (row: unknown[], name: string) =>
        row[cols.indexOf(name)] as string | number | null | undefined;

      return result[0]!.values.map((row) => ({
        interactionId: get(row as unknown[], "entry_id")! as string,
        platformId: "unknown", // session_chronicle has no platform_id column
        summary: get(row as unknown[], "summary")! as string,
        contentRef: (get(row as unknown[], "related_decision_id") as string | undefined) ?? undefined,
        isReply: get(row as unknown[], "result") === "reply",
        repliedAt: undefined,
        createdAt: get(row as unknown[], "occurred_at")! as string,
      }));
    },
  };
}
