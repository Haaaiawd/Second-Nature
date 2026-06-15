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
 * - `src/storage/v8-state-stores.js` (writeEvidenceItem, readEvidenceItemById)
 *
 * Boundary:
 * - Does not judge evidence importance.
 * - Does not fabricate evidence on empty or failed connector results.
 * - Deduplicates by externalId first, then content hash, across runs.
 *
 * Test coverage: tests/unit/connectors/evidence-normalizer.test.ts
 */
import * as crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { evidenceItem } from "../storage/db/schema/v8-entities.js";
import { writeEvidenceItem, readEvidenceItemById } from "../storage/v8-state-stores.js";
import { extractNormalizedEvidenceItems, computeEvidenceContentHashSync, } from "./base/normalized-evidence-content.js";
// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────
function computeLegacyContentHash(content) {
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
const SECRET_KEYWORD_RE = /\b(?:api[-_]?key|auth[-_]?token|access[-_]?token|secret|password|credential|private[-_]?key)\b/i;
const SECRET_VALUE_RE = /\b[a-zA-Z0-9_]+\s*[:=]\s*["']([^"'\s]{20,})["']/;
function inferSensitivityHint(content) {
    // Only flag sensitive when a secret keyword is paired with a value-like shape.
    // Broad keyword matches alone are not enough to classify public_technical.
    if (SECRET_KEYWORD_RE.test(content) && SECRET_VALUE_RE.test(content)) {
        return "sensitive";
    }
    return "public_general";
}
function mergeSensitivityHint(fromContent, explicit) {
    if (explicit === "sensitive" || fromContent === "sensitive")
        return "sensitive";
    if (explicit === "private_context" || fromContent === "private_context")
        return "private_context";
    if (explicit === "public_technical" || fromContent === "public_technical")
        return "public_technical";
    return explicit ?? fromContent;
}
function stableEvidenceId(platformId, capabilityId, externalId, contentHash) {
    const key = externalId ?? contentHash;
    return `ev_${platformId}_${capabilityId}_${key}`;
}
async function findExistingEvidenceByExternalId(db, id) {
    const result = await readEvidenceItemById(db, id);
    if ("row" in result && result.row) {
        return {
            id: result.row.id,
            observedAt: result.row.observedAt,
            payloadJson: result.row.payloadJson ?? null,
        };
    }
    return undefined;
}
function buildPayloadJson(content) {
    return JSON.stringify(content);
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
    // Extract content-bearing items from payload
    const observedAt = result.observedAt ?? now;
    const normalizedItems = extractNormalizedEvidenceItems(result.data ?? result.items ?? [], {
        platformId: result.platformId,
        capabilityId: result.capabilityId,
        observedAt,
        summaryProducer: "connector_rules",
    });
    // Empty result — no fabrication
    if (normalizedItems.length === 0) {
        // Legacy fallback: if caller passed flat items, still try to produce evidence.
        return normalizeLegacyConnectorEvidence(db, result, now);
    }
    // Truncate if over 100 items
    const items = normalizedItems.slice(0, 100);
    const truncated = normalizedItems.length > 100;
    const seenKeys = new Set();
    const evidenceIds = [];
    for (const content of items) {
        const contentHash = computeEvidenceContentHashSync(content);
        const key = `ev_${result.platformId}_${result.capabilityId}_${content.externalId ?? contentHash}`;
        if (seenKeys.has(key))
            continue;
        seenKeys.add(key);
        const evidenceId = stableEvidenceId(result.platformId, result.capabilityId, content.externalId, contentHash);
        const existing = await findExistingEvidenceByExternalId(db, evidenceId);
        const sourceRef = buildSourceRef(result.platformId, result.capabilityId, content.externalId ?? contentHash, observedAt);
        const sensitivityHint = mergeSensitivityHint(inferSensitivityHint(content.summary), inferSensitivityHint(content.title ?? ""));
        if (existing) {
            // Idempotent update: refresh observedAt and seen count; do not duplicate.
            try {
                await db.db
                    .update(evidenceItem)
                    .set({
                    observedAt,
                    payloadJson: JSON.stringify({
                        ...JSON.parse(existing.payloadJson ?? "{}"),
                        lastObservedAt: observedAt,
                        seenCount: (JSON.parse(existing.payloadJson ?? "{}").seenCount ?? 1) + 1,
                    }),
                })
                    .where(eq(evidenceItem.id, existing.id));
                evidenceIds.push(existing.id);
                continue;
            }
            catch {
                // Fall through to insert attempt if update fails.
            }
        }
        const writeResult = await writeEvidenceItem(db, {
            id: evidenceId,
            createdAt: now,
            platformId: result.platformId,
            contentHash,
            observedAt,
            sensitivityHint,
            sourceRefs: [sourceRef],
            redactionClass: sensitivityHint === "sensitive" ? "blocked" : "none",
            lifecycleStatus: "pending",
            payloadJson: buildPayloadJson(content),
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
/**
 * Legacy fallback for callers that still pass flat ConnectorReadItem[] without `data`.
 * This preserves the previous behavior while allowing gradual migration to content-bearing payloads.
 */
async function normalizeLegacyConnectorEvidence(db, result, now) {
    const items = result.items ?? [];
    if (items.length === 0) {
        return {
            evidenceIds: [],
            emptyReason: "evidence_batch_empty",
        };
    }
    const truncated = items.length > 100;
    const seenHashes = new Set();
    const evidenceIds = [];
    for (const item of items) {
        if (typeof item.content !== "string")
            continue;
        const contentHash = computeLegacyContentHash(item.content);
        if (seenHashes.has(contentHash))
            continue;
        seenHashes.add(contentHash);
        const itemId = item.id ?? `ev_${contentHash}`;
        const observedAt = result.observedAt ?? now;
        const sourceRef = buildSourceRef(result.platformId, result.capabilityId, itemId, observedAt);
        const sensitivityHint = mergeSensitivityHint(inferSensitivityHint(item.content), item.sensitivityHint);
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
