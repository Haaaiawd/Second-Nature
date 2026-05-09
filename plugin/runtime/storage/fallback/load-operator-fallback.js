import { eq } from "drizzle-orm";
import { operatorFallbackArtifacts } from "../db/schema/operator-fallback-artifacts.js";
const REASONS = new Set(["target_none", "channel_missing", "host_unsupported", "delivery_failed"]);
export function normalizeFallbackRef(ref) {
    const t = ref.trim();
    if (!t)
        return t;
    return t.startsWith("fallback:") ? t : `fallback:${t}`;
}
function parseSourceRefs(json) {
    try {
        const parsed = JSON.parse(json);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
/** Loads persisted operator fallback row; does not coerce status (use `toOperatorFallbackView`). */
export async function loadOperatorFallbackRow(state, fallbackRef) {
    const key = normalizeFallbackRef(fallbackRef);
    if (!key)
        return null;
    const rows = await state.db.select().from(operatorFallbackArtifacts).where(eq(operatorFallbackArtifacts.fallbackRef, key)).limit(1);
    const row = rows[0];
    if (!row)
        return null;
    return {
        fallbackRef: row.fallbackRef,
        reason: row.reason,
        status: row.status,
        sourceRefs: parseSourceRefs(row.sourceRefsJson),
        candidateMessage: row.candidateMessage ?? undefined,
        nextStep: row.nextStep,
    };
}
export function toOperatorFallbackView(row) {
    const reason = REASONS.has(row.reason) ? row.reason : row.reason;
    return {
        fallbackRef: row.fallbackRef,
        reason,
        status: "not_sent",
        sourceRefs: row.sourceRefs,
        candidateMessage: row.candidateMessage,
        nextStep: row.nextStep,
    };
}
