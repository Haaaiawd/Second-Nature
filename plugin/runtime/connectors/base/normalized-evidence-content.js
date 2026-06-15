/**
 * NormalizedEvidenceContent — Cross-platform content-bearing evidence envelope.
 *
 * Core logic: Map arbitrary connector read payloads into a stable, source-backed
 * summary structure that perception, Quiet, and Dream can consume. This is a
 * schema boundary, not a judgment layer.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/connector-system.md`
 * - `.anws/v8/04_SYSTEM_DESIGN/perception-judgment-system.md`
 *
 * Dependencies:
 * - none (pure extraction)
 *
 * Boundary:
 * - Does not classify sensitivity.
 * - Does not redact; callers run redaction separately.
 * - Does not persist; callers write EvidenceItem.
 * - Preserves raw values in canonicalText/excerpt so downstream can decide what to keep.
 *
 * Test coverage: tests/unit/connectors/normalized-evidence-content.test.ts
 */
export const NORMALIZED_EVIDENCE_SCHEMA_VERSION = 1;
// ───────────────────────────────────────────────────────────────
// String helpers
// ───────────────────────────────────────────────────────────────
function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
}
function firstNonEmptyString(values) {
    for (const v of values) {
        if (isNonEmptyString(v))
            return v.trim();
    }
    return undefined;
}
function truncate(text, maxChars) {
    if (text.length <= maxChars)
        return text;
    return `${text.slice(0, maxChars)}…`;
}
function toStringArray(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .map((item) => (typeof item === "string" ? item.trim() : String(item ?? "").trim()))
        .filter((item) => item.length > 0);
}
function normalizeDate(value) {
    if (typeof value !== "string" || value.trim().length === 0)
        return undefined;
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed))
        return undefined;
    return new Date(parsed).toISOString();
}
// ───────────────────────────────────────────────────────────────
// Object traversal helpers
// ───────────────────────────────────────────────────────────────
function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
function findFirstValue(obj, keys) {
    if (!isRecord(obj))
        return undefined;
    for (const key of keys) {
        if (key in obj)
            return obj[key];
    }
    return undefined;
}
function findDeepValue(obj, keys) {
    const queue = [obj];
    while (queue.length > 0) {
        const current = queue.shift();
        if (isRecord(current)) {
            const found = findFirstValue(current, keys);
            if (found !== undefined)
                return found;
            for (const v of Object.values(current)) {
                queue.push(v);
            }
        }
        else if (Array.isArray(current)) {
            for (const v of current) {
                queue.push(v);
            }
        }
    }
    return undefined;
}
// ───────────────────────────────────────────────────────────────
// Source kind inference
// ───────────────────────────────────────────────────────────────
function inferSourceKind(item) {
    const typeHint = String(findFirstValue(item, ["type", "kind", "sourceKind", "object", "category"]) ?? "").toLowerCase();
    if (typeHint.includes("post"))
        return "post";
    if (typeHint.includes("comment") || typeHint.includes("reply"))
        return "comment";
    if (typeHint.includes("profile") || typeHint.includes("user") || typeHint.includes("author"))
        return "profile";
    if (typeHint.includes("task") || typeHint.includes("issue") || typeHint.includes("todo"))
        return "task";
    if (typeHint.includes("event") || typeHint.includes("activity"))
        return "event";
    if (typeHint.includes("game") || typeHint.includes("match") || typeHint.includes("score"))
        return "game_state";
    if (typeHint.includes("notification") || typeHint.includes("alert"))
        return "notification";
    if (typeHint.includes("document") || typeHint.includes("article") || typeHint.includes("page"))
        return "document";
    return "unknown";
}
// ───────────────────────────────────────────────────────────────
// Field extraction
// ───────────────────────────────────────────────────────────────
function extractId(item) {
    const id = findFirstValue(item, ["id", "externalId", "postId", "taskId", "eventId"]);
    if (id === undefined || id === null)
        return undefined;
    return String(id).trim();
}
function extractTitle(item) {
    return firstNonEmptyString([
        findFirstValue(item, ["title", "subject", "heading", "name", "displayName"]),
    ]);
}
function extractBodyText(item) {
    return firstNonEmptyString([
        findFirstValue(item, ["content", "body", "text", "description", "message", "snippet", "summary"]),
    ]);
}
function extractUrl(item) {
    const url = findFirstValue(item, ["url", "link", "permalink", "href", "webUrl"]);
    if (!isNonEmptyString(url))
        return undefined;
    try {
        new URL(url);
        return url;
    }
    catch {
        return undefined;
    }
}
function extractActor(item) {
    const author = findFirstValue(item, ["author", "creator", "user", "actor", "from"]);
    if (!isRecord(author) && !isNonEmptyString(author))
        return undefined;
    if (isNonEmptyString(author)) {
        return { displayName: author };
    }
    const displayName = firstNonEmptyString([
        findFirstValue(author, ["displayName", "name", "username", "handle", "login"]),
    ]);
    const id = firstNonEmptyString([findFirstValue(author, ["id", "userId", "accountId"])]);
    const role = firstNonEmptyString([findFirstValue(author, ["role", "type"])]);
    if (!displayName && !id)
        return undefined;
    return { displayName, id, role };
}
function extractOccurredAt(item) {
    return normalizeDate(findFirstValue(item, ["createdAt", "publishedAt", "occurredAt", "timestamp", "date", "time"]));
}
function extractTags(item) {
    const tags = findFirstValue(item, ["tags", "labels", "categories", "topics"]);
    return toStringArray(tags);
}
function extractEntities(item) {
    const entities = findFirstValue(item, ["entities", "mentions", "hashtags", "keywords"]);
    return toStringArray(entities);
}
function extractMetrics(item) {
    const metrics = findFirstValue(item, ["metrics", "stats", "counts", "engagement"]);
    if (!isRecord(metrics))
        return undefined;
    const out = {};
    for (const [k, v] of Object.entries(metrics)) {
        if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") {
            out[k] = v;
        }
    }
    return Object.keys(out).length > 0 ? out : undefined;
}
// ───────────────────────────────────────────────────────────────
// Item extraction from connector payload
// ───────────────────────────────────────────────────────────────
function extractItems(data) {
    if (Array.isArray(data))
        return data;
    if (!isRecord(data))
        return [];
    for (const key of ["items", "data", "results", "posts", "nodes", "agents", "edges", "entries", "feed"]) {
        const candidate = data[key];
        if (Array.isArray(candidate))
            return candidate;
    }
    // If the payload itself looks like a single item, treat it as one-item array.
    if ("id" in data || "title" in data || "content" in data)
        return [data];
    return [];
}
function normalizeSingleItem(item, options) {
    if (!isRecord(item))
        return null;
    const sourceKind = inferSourceKind(item);
    const externalId = extractId(item);
    const title = extractTitle(item);
    const bodyText = extractBodyText(item);
    const url = extractUrl(item);
    const actor = extractActor(item);
    const occurredAt = extractOccurredAt(item);
    const tags = extractTags(item);
    const entities = extractEntities(item);
    const metrics = extractMetrics(item);
    const rawText = bodyText ?? title ?? "[no readable content]";
    const summary = truncate(rawText, 160);
    const excerpt = rawText.length > summary.length ? truncate(rawText, options.excerptMaxChars ?? 240) : undefined;
    const canonicalText = truncate(rawText, options.canonicalTextMaxChars ?? 2000);
    return {
        schemaVersion: NORMALIZED_EVIDENCE_SCHEMA_VERSION,
        sourceKind,
        platformId: options.platformId,
        capabilityId: options.capabilityId,
        externalId,
        title,
        summary,
        excerpt,
        canonicalText,
        actor,
        url,
        occurredAt,
        observedAt: options.observedAt ?? new Date().toISOString(),
        tags,
        entities,
        metrics,
        summaryProducer: options.summaryProducer ?? "connector_rules",
    };
}
/**
 * Extract a list of content-bearing evidence items from a connector success payload.
 * Returns empty array when data is not an object/array or contains no extractable items.
 */
export function extractNormalizedEvidenceItems(data, options) {
    const items = extractItems(data);
    const out = [];
    for (const item of items) {
        const normalized = normalizeSingleItem(item, options);
        if (normalized)
            out.push(normalized);
    }
    return out;
}
/**
 * Compute a stable content hash for deduplication across connector runs.
 * Prefer externalId-based identity; this hash is the fallback.
 */
export function computeEvidenceContentHash(content) {
    return computeEvidenceContentHashSync(content);
}
import * as crypto from "node:crypto";
export function computeEvidenceContentHashSync(content) {
    const canonical = [
        content.platformId,
        content.capabilityId,
        content.externalId ?? "",
        content.title ?? "",
        content.summary,
        content.excerpt ?? "",
        content.canonicalText ?? "",
    ].join("\u0000");
    return crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}
