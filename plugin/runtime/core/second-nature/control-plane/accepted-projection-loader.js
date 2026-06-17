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
import { readMemoryProjectionsByStatus, } from "../../../storage/v8-state-stores.js";
import { parseSourceRefs } from "../../../shared/serialization.js";
// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────
function parsePayloadJson(json) {
    if (!json)
        return {};
    try {
        return JSON.parse(json);
    }
    catch {
        return {};
    }
}
// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────
export async function loadAcceptedProjections(db, _options) {
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
    const projections = allProjections.map((row) => {
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
