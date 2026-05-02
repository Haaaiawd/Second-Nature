/**
 * Redacted audit export bundle for operator / retention tooling (T5.3.1).
 *
 * Core logic: load range, attach export metadata; payloads are already redacted at envelope build time.
 *
 * Dependencies: same range loader pattern as verifyAuditHashChain.
 *
 * Test coverage: tests/integration/observability/explain-query-export.test.ts
 */
import * as crypto from "node:crypto";
function summarize(events) {
    const ids = new Set();
    for (const e of events) {
        ids.add(e.redaction.manifestId);
    }
    return { eventCount: events.length, manifestIds: [...ids] };
}
export async function exportAuditBundle(range, deps) {
    const events = [...(await deps.loadRange(range.from, range.to, range.families))].sort((a, b) => a.sequence - b.sequence);
    return {
        bundleId: crypto.randomUUID(),
        generatedAt: new Date().toISOString(),
        range,
        events,
        redactionSummary: summarize(events),
    };
}
