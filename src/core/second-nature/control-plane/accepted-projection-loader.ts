/**
 * AcceptedProjectionLoader — Load accepted long-term memory into EmbodiedContext.
 *
 * Core logic: Read active/accepted projections from state, exclude candidates,
 * and return bounded memory slice for heartbeat context assembly.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/control-plane-system.md §5`
 * - `.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.md §4.2`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (readMemoryProjectionsByStatus)
 * - `src/shared/types/v8-contracts.js` (SourceRef, DegradedOperationResult)
 *
 * Boundary:
 * - Only loads accepted/active projections; candidates are excluded.
 * - Does not judge projection importance; loads all active.
 * - Degrades gracefully on unreadable state.
 *
 * Test coverage: tests/unit/control-plane/accepted-projection-loader.test.ts
 */

import type { StateDatabase } from "../../../storage/db/index.js";
import {
  readMemoryProjectionsByStatus,
} from "../../../storage/v8-state-stores.js";
import { parseSourceRefs } from "../../../shared/serialization.js";
import type {
  SourceRef,
  DegradedOperationResult,
} from "../../../shared/types/v8-contracts.js";

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

export interface MemoryProjectionSlice {
  projections: AcceptedProjection[];
  topicKeys: string[];
  totalProjections: number;
}

export interface AcceptedProjection {
  id: string;
  topicKey: string;
  memoryText: string;
  sourceRefs: SourceRef[];
  acceptedAt?: string;
}

export type LoadAcceptedProjectionsResult =
  | {
      ok: true;
      slice: MemoryProjectionSlice;
    }
  | {
      ok: false;
      degraded: DegradedOperationResult;
    };

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

function parsePayloadJson(json: string | null): Record<string, unknown> {
  if (!json) return {};
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────

export async function loadAcceptedProjections(
  db: StateDatabase,
  _options?: { limit?: number },
): Promise<LoadAcceptedProjectionsResult> {
  const activeResult = await readMemoryProjectionsByStatus(db, "active");
  if (activeResult.degraded) {
    return {
      ok: false,
      degraded: activeResult.degraded,
    };
  }

  const acceptedResult = await readMemoryProjectionsByStatus(db, "accepted");
  if (acceptedResult.degraded) {
    return {
      ok: false,
      degraded: acceptedResult.degraded,
    };
  }

  const allProjections = [...activeResult.rows, ...acceptedResult.rows];

  const projections: AcceptedProjection[] = allProjections.map((row) => {
    const payload = parsePayloadJson(row.payloadJson);
    return {
      id: row.id,
      topicKey: row.topicKey,
      memoryText: String(payload.memoryText ?? ""),
      sourceRefs: parseSourceRefs(row.sourceRefsJson),
      acceptedAt: payload.acceptedAt ? String(payload.acceptedAt) : undefined,
    };
  });

  const topicKeys = [...new Set(projections.map((p) => p.topicKey))];

  return {
    ok: true,
    slice: {
      projections,
      topicKeys,
      totalProjections: projections.length,
    },
  };
}
