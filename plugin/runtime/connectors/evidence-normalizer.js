/**
 * EvidenceNormalizer — Convert connector read results into v8 EvidenceItems.
 *
 * Core logic: Map successful read-type ConnectorResult payloads into
 * deduplicated EvidenceItem rows with structured SourceRef, content hash,
 * platform id, observedAt, and sensitivity hint.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/connector-system.md`
 * - `.anws/v8/02_ARCHITECTURE_OVERVIEW.md §System 7`
 *
 * Dependencies:
 * - `src/shared/types/v8-contracts.js` (SourceRef, V8ReasonCode)
 * - `src/storage/v8-state-stores.js` (writeEvidenceItem)
 *
 * Boundary:
 * - Does not judge evidence importance.
 * - Does not fabricate evidence on empty or failed connector results.
 * - Deduplicates by content hash within a single normalization run.
 *
 * Test coverage: tests/unit/connectors/evidence-normalizer.test.ts
 */
import * as crypto from "node:crypto";
import { writeEvidenceItem } from "../storage/v8-state-stores.js";
// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────
function computeContentHash(content) {
    return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}
function buildSourceRef(platformId, capabilityId, itemId, observedAt) {
    return {
        uri: `sn://connector_result/${platformId}/${capabilityId}/${itemId}`,
        family: "connector_result",
        id: `${platformId}_${capabilityId}_${itemId}`,
        redactionClass: "none",
        resolveStatus: "resolvable",
    };
}
function inferSensitivityHint(item) {
    if (item.sensitivityHint)
        return item.sensitivityHint;
    const content = item.content;
    if (/token|secret|password|key|credential/i.test(content)) {
        if (/\b[a-zA-Z0-9_]+\s*[:=]\s*['"][a-zA-Z0-9+/=]{20,}['"]/.test(content)) {
            return "sensitive";
        }
        return "public_technical";
    }
    return "public_general";
}
// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────
export async function normalizeConnectorEvidence(db, result, now = new Date().toISOString()) {
    // Reject failed/unavailable/timeout results — no fabrication
    if (result.status !== "success") {
        return {
            evidenceIds: [],
            emptyReason: "ingestion_connector_failed",
        };
    }
    // Empty result — no fabrication
    if (!result.items || result.items.length === 0) {
        return {
            evidenceIds: [],
            emptyReason: "evidence_batch_empty",
        };
    }
    // Truncate if over 100 items
    const items = result.items.slice(0, 100);
    const truncated = result.items.length > 100;
    const seenHashes = new Set();
    const evidenceIds = [];
    for (const item of items) {
        if (typeof item.content !== "string") {
            continue;
        }
        const contentHash = computeContentHash(item.content);
        // Deduplicate by content hash
        if (seenHashes.has(contentHash))
            continue;
        seenHashes.add(contentHash);
        const itemId = item.id ?? `ev_${contentHash}`;
        const observedAt = result.observedAt ?? now;
        const sourceRef = buildSourceRef(result.platformId, result.capabilityId, itemId, observedAt);
        const sensitivityHint = inferSensitivityHint(item);
        const writeResult = await writeEvidenceItem(db, {
            id: `ev_${result.platformId}_${itemId}_${observedAt.replace(/[:.]/g, "")}`,
            createdAt: now,
            platformId: result.platformId,
            contentHash,
            observedAt,
            sensitivityHint,
            sourceRefs: [sourceRef],
            redactionClass: sensitivityHint === "sensitive" ? "blocked" : "none",
            lifecycleStatus: "pending",
            payloadJson: item.metadata ? JSON.stringify(item.metadata) : null,
        });
        if ("id" in writeResult) {
            evidenceIds.push(writeResult.id);
        }
        else {
            // Degraded write — continue with remaining items, report degraded
            return {
                evidenceIds,
                degraded: writeResult,
            };
        }
    }
    return {
        evidenceIds,
        emptyReason: truncated ? "evidence_batch_truncated" : undefined,
    };
}
