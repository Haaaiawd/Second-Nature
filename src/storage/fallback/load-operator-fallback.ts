import { eq } from "drizzle-orm";
import type { StateDatabase } from "../db/index.js";
import { operatorFallbackArtifacts } from "../db/schema/operator-fallback-artifacts.js";
import type { LifeEvidenceSourceRef } from "../life-evidence/types.js";
import type { OperatorFallbackReason } from "./operator-fallback-types.js";
import type { OperatorFallbackView } from "./operator-fallback-view.js";

const REASONS: ReadonlySet<string> = new Set(["target_none", "channel_missing", "host_unsupported", "delivery_failed"]);

export function normalizeFallbackRef(ref: string): string {
  const t = ref.trim();
  if (!t) return t;
  return t.startsWith("fallback:") ? t : `fallback:${t}`;
}

function parseSourceRefs(json: string): LifeEvidenceSourceRef[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    return Array.isArray(parsed) ? (parsed as LifeEvidenceSourceRef[]) : [];
  } catch {
    return [];
  }
}

/** Loads persisted operator fallback row; does not coerce status (use `toOperatorFallbackView`). */
export async function loadOperatorFallbackRow(
  state: StateDatabase,
  fallbackRef: string,
): Promise<{
  fallbackRef: string;
  reason: string;
  status: string;
  sourceRefs: LifeEvidenceSourceRef[];
  candidateMessage?: string;
  nextStep: string;
} | null> {
  const key = normalizeFallbackRef(fallbackRef);
  if (!key) return null;

  const rows = await state.db.select().from(operatorFallbackArtifacts).where(eq(operatorFallbackArtifacts.fallbackRef, key)).limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    fallbackRef: row.fallbackRef,
    reason: row.reason,
    status: row.status,
    sourceRefs: parseSourceRefs(row.sourceRefsJson),
    candidateMessage: row.candidateMessage ?? undefined,
    nextStep: row.nextStep,
  };
}

export function toOperatorFallbackView(row: NonNullable<Awaited<ReturnType<typeof loadOperatorFallbackRow>>>): OperatorFallbackView {
  const reason = REASONS.has(row.reason) ? (row.reason as OperatorFallbackReason) : row.reason;
  return {
    fallbackRef: row.fallbackRef,
    reason,
    status: "not_sent",
    sourceRefs: row.sourceRefs,
    candidateMessage: row.candidateMessage,
    nextStep: row.nextStep,
  };
}
