/**
 * Shared serialization helpers for cross-system value types.
 *
 * Core logic:
 * - `parseSourceRefs` / `serializeSourceRefs` provide the single round-trip
 *   implementation for `sourceRefsJson` / `source_refs_json` columns.
 * - Failures are silent on read (return empty array) because malformed JSON
 *   in persisted state must not crash downstream consumers; callers that need
 *   to distinguish malformed rows should validate separately.
 *
 * Dependencies: `src/shared/types/v8-contracts.js` (SourceRef)
 * Boundary: Pure functions; no storage or business logic.
 * Test coverage: `tests/unit/shared/source-ref-serialization.test.ts`
 */
import type { SourceRef } from "./types/v8-contracts.js";

export function serializeSourceRefs(refs: SourceRef[]): string {
  return JSON.stringify(refs);
}

export function parseSourceRefs(json: string | null | undefined): SourceRef[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed as SourceRef[];
    return [];
  } catch {
    return [];
  }
}
