/**
 * Minimal loadUserInterestSnapshot: anchor + curated presence, no fabricated preferences (T4.2.2).
 *
 * Core logic: USER.md / MEMORY.md / memory/curated/*.md drive signals; otherwise insufficient.
 * Boundaries: never invent topics; staleness insufficient when anchors missing and no curated signals.
 */
import * as crypto from "node:crypto";
import * as fs from "fs/promises";
import * as path from "node:path";
import { fileExists, readText } from "../memory/workspace/paths.js";
const MIN_MEANINGFUL_ANCHOR_CHARS = 24;
const STALE_MS = 30 * 24 * 60 * 60 * 1000;
const INSUFFICIENT_CONFIDENCE_THRESHOLD = 0.35;
function anchorRef(asset, workspaceRoot) {
    return {
        id: `anchor:${asset}`,
        kind: "user_anchor",
        uri: path.join(workspaceRoot, asset),
        observedAt: new Date().toISOString(),
    };
}
async function newestMtime(paths) {
    let max = 0;
    for (const p of paths) {
        try {
            const st = await fs.stat(p);
            max = Math.max(max, st.mtimeMs);
        }
        catch {
            /* missing */
        }
    }
    return max;
}
async function listCuratedSignalFiles(workspaceRoot) {
    const dir = path.join(workspaceRoot, "memory", "curated");
    if (!(await fileExists(dir)))
        return [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isFile() && e.name.endsWith(".md")).map((e) => path.join(dir, e.name));
}
export async function loadUserInterestSnapshot(workspaceRoot) {
    const generatedAt = new Date().toISOString();
    const userPath = path.join(workspaceRoot, "USER.md");
    const memoryPath = path.join(workspaceRoot, "MEMORY.md");
    const hasUser = await fileExists(userPath);
    const hasMemory = await fileExists(memoryPath);
    const userText = hasUser ? (await readText(userPath)).trim() : "";
    const memoryText = hasMemory ? (await readText(memoryPath)).trim() : "";
    const curatedFiles = await listCuratedSignalFiles(workspaceRoot);
    const curatedNonEmpty = [];
    for (const fp of curatedFiles) {
        const body = (await readText(fp)).trim();
        if (body.length >= MIN_MEANINGFUL_ANCHOR_CHARS)
            curatedNonEmpty.push(fp);
    }
    const userOk = hasUser && userText.length >= MIN_MEANINGFUL_ANCHOR_CHARS;
    const memoryOk = hasMemory && memoryText.length >= MIN_MEANINGFUL_ANCHOR_CHARS;
    if (!userOk && !memoryOk && curatedNonEmpty.length === 0) {
        return {
            snapshotId: crypto.randomUUID(),
            generatedAt,
            signals: [],
            sourceRefs: [],
            confidence: 0,
            staleness: "insufficient",
            missingReasons: ["missing_user_interest_model"],
        };
    }
    const signals = [];
    const allRefs = [];
    if (userOk) {
        const ref = anchorRef("USER.md", workspaceRoot);
        allRefs.push(ref);
        signals.push({
            id: `interest:user:${crypto.randomUUID()}`,
            topic: "user_anchor_profile",
            affinity: "unknown",
            reason: "derived_from_USER.md_anchor",
            confidence: 0.55,
            sourceRefs: [ref],
            updatedAt: generatedAt,
        });
    }
    if (memoryOk) {
        const ref = anchorRef("MEMORY.md", workspaceRoot);
        allRefs.push(ref);
        signals.push({
            id: `interest:memory:${crypto.randomUUID()}`,
            topic: "relational_memory_anchor",
            affinity: "watching",
            reason: "derived_from_MEMORY.md_anchor",
            confidence: 0.52,
            sourceRefs: [ref],
            updatedAt: generatedAt,
        });
    }
    for (const fp of curatedNonEmpty) {
        const ref = {
            id: `curated:${path.basename(fp, ".md")}`,
            kind: "workspace_artifact",
            uri: fp,
            observedAt: generatedAt,
        };
        allRefs.push(ref);
        signals.push({
            id: `interest:curated:${crypto.randomUUID()}`,
            topic: `curated:${path.basename(fp, ".md")}`,
            affinity: "positive",
            reason: "derived_from_curated_memory_file",
            confidence: 0.48,
            sourceRefs: [ref],
            updatedAt: generatedAt,
        });
    }
    if (signals.length === 0) {
        return {
            snapshotId: crypto.randomUUID(),
            generatedAt,
            signals: [],
            sourceRefs: [],
            confidence: 0,
            staleness: "insufficient",
            missingReasons: ["missing_user_interest_model"],
        };
    }
    const confidence = signals.reduce((s, x) => s + x.confidence, 0) / signals.length;
    if (confidence < INSUFFICIENT_CONFIDENCE_THRESHOLD) {
        return {
            snapshotId: crypto.randomUUID(),
            generatedAt,
            signals: [],
            sourceRefs: [],
            confidence: 0,
            staleness: "insufficient",
            missingReasons: ["missing_user_interest_model"],
        };
    }
    const mtimes = await newestMtime([hasUser ? userPath : "", hasMemory ? memoryPath : "", ...curatedNonEmpty].filter(Boolean));
    const staleness = mtimes > 0 && Date.now() - mtimes > STALE_MS ? "stale" : "fresh";
    const uniqueRefs = [...new Map(allRefs.map((r) => [r.uri, r])).values()];
    return {
        snapshotId: crypto.randomUUID(),
        generatedAt,
        signals,
        sourceRefs: uniqueRefs,
        confidence,
        staleness,
    };
}
