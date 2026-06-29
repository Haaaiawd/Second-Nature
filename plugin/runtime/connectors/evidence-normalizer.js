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
function truncate(text, maxChars) {
    if (text.length <= maxChars)
        return text;
    return `${text.slice(0, maxChars)}…`;
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
            contentHash: result.row.contentHash,
            seenCount: result.row.seenCount ?? 1,
            stableIdentityKey: result.row.stableIdentityKey,
            rowIdentityStatus: result.row.rowIdentityStatus,
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
            // contentHash column is kept as the first observed hash to support
            // repetition=changed detection in v9 attention-system.
            try {
                const payload = JSON.parse(existing.payloadJson ?? "{}");
                const isChangedContent = contentHash !== existing.contentHash;
                await db.db
                    .update(evidenceItem)
                    .set({
                    observedAt,
                    lastObservedAt: observedAt,
                    seenCount: (existing.seenCount ?? 1) + 1,
                    stableIdentityKey: existing.stableIdentityKey || content.externalId || contentHash,
                    rowIdentityStatus: existing.rowIdentityStatus || (content.externalId ? "stable" : "unstable"),
                    payloadJson: JSON.stringify({
                        ...payload,
                        lastObservedAt: observedAt,
                        seenCount: (Number(payload.seenCount) || 1) + 1,
                        firstContentHash: isChangedContent
                            ? (existing.contentHash ?? contentHash)
                            : (payload.firstContentHash ?? existing.contentHash ?? contentHash),
                        latestContentHash: contentHash,
                    }),
                })
                    .where(eq(evidenceItem.id, existing.id));
                evidenceIds.push(existing.id);
                continue;
            }
            catch {
                // Existing row is known but the idempotent update failed. Do not fall
                // through to the insert path, because writeEvidenceItem's upsert would
                // increment seenCount a second time and overwrite first-content metadata.
                // Keep the existing evidence id; the next heartbeat will retry the update.
                evidenceIds.push(existing.id);
                continue;
            }
        }
        const writeResult = await writeEvidenceItem(db, {
            id: evidenceId,
            createdAt: now,
            platformId: result.platformId,
            externalId: content.externalId,
            contentHash,
            stableIdentityKey: content.externalId ?? contentHash,
            observedAt,
            firstObservedAt: observedAt,
            lastObservedAt: observedAt,
            seenCount: 1,
            rowIdentityStatus: content.externalId ? "stable" : "unstable",
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
        const trimmedContent = item.content.trim();
        const looksLikeIdOnly = /^[a-z0-9_-]+$/i.test(trimmedContent) && trimmedContent.length < 64;
        const contentStatus = looksLikeIdOnly || trimmedContent.length === 0
            ? "content_missing"
            : "content_present";
        const contentMissingReason = contentStatus === "content_missing"
            ? trimmedContent.length === 0
                ? "empty_payload"
                : "id_only"
            : undefined;
        const normalized = {
            schemaVersion: 1,
            sourceKind: "unknown",
            platformId: result.platformId,
            capabilityId: result.capabilityId,
            externalId: item.id,
            summary: contentStatus === "content_missing"
                ? `Content missing: ${contentMissingReason === "id_only" ? "id-only evidence" : "empty payload"}`
                : truncate(trimmedContent, 160),
            contentStatus,
            contentMissingReason,
            excerpt: contentStatus === "content_present" ? truncate(trimmedContent, 240) : undefined,
            canonicalText: contentStatus === "content_present" ? truncate(trimmedContent, 2000) : undefined,
            observedAt,
            summaryProducer: "connector_rules",
        };
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
            payloadJson: JSON.stringify(normalized),
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
