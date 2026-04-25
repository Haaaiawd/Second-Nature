import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
export const ASSET_CONFIG = {
    workspaceRoot: "./workspace",
    journalsDir: "memory",
    reportsDir: "memory/reports",
    curatedDir: "memory/curated",
    proposalsDir: "memory/proposals",
    anchorAssets: ["SOUL.md", "USER.md", "IDENTITY.md", "MEMORY.md", "AGENTS.md"],
};
export async function ensureDirectory(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}
export function resolveDailyJournalPath(timestamp) {
    const date = timestamp.split("T")[0];
    return path.join(ASSET_CONFIG.workspaceRoot, ASSET_CONFIG.journalsDir, `${date}.md`);
}
export function resolveDailyReportPath(day) {
    return path.join(ASSET_CONFIG.workspaceRoot, ASSET_CONFIG.reportsDir, `${day}.md`);
}
export function resolveCuratedPath(id) {
    return path.join(ASSET_CONFIG.workspaceRoot, ASSET_CONFIG.curatedDir, `${id}.md`);
}
export function resolveProposalPath(proposalId) {
    return path.join(ASSET_CONFIG.workspaceRoot, ASSET_CONFIG.proposalsDir, `${proposalId}.md`);
}
export function resolveAnchorPath(assetName) {
    return path.join(ASSET_CONFIG.workspaceRoot, assetName);
}
export async function writeCanonicalArtifact(filePath, content) {
    await ensureDirectory(path.dirname(filePath));
    const tempPath = `${filePath}.tmp`;
    await fs.writeFile(tempPath, content, "utf-8");
    await fs.rename(tempPath, filePath);
}
export async function appendLine(filePath, line) {
    await ensureDirectory(path.dirname(filePath));
    const exists = await fileExists(filePath);
    const prefix = exists ? "\n" : "";
    await fs.appendFile(filePath, `${prefix}${line}`, "utf-8");
}
export async function readText(filePath) {
    try {
        return await fs.readFile(filePath, "utf-8");
    }
    catch {
        return "";
    }
}
export async function hashFile(filePath) {
    try {
        const content = await fs.readFile(filePath);
        return crypto.createHash("sha256").update(content).digest("hex");
    }
    catch {
        return "";
    }
}
export async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    }
    catch {
        return false;
    }
}
export function buildJournalAssetId(filePath) {
    return `journal:${path.basename(filePath, ".md")}`;
}
export function buildReportAssetId(day) {
    return `report:${day}`;
}
export function serializeActivityLog(entry) {
    const meta = entry.platform ? `[${entry.platform}] ` : "";
    const sources = entry.sourceRefs.length > 0 ? ` (refs: ${entry.sourceRefs.join(", ")})` : "";
    return `- [${entry.timestamp}] ${meta}${entry.kind}: ${entry.content}${sources}`;
}
export function serializeObservation(entry) {
    const mood = entry.mood ? ` (${entry.mood})` : "";
    const sources = entry.sourceRefs.length > 0 ? ` [${entry.sourceRefs.join(", ")}]` : "";
    return `- [${entry.timestamp}] ${entry.summary}${mood}${sources}`;
}
export function renderDailyReport(input) {
    const lines = [
        `# Daily Report — ${input.day}`,
        "",
        "## Summary",
        input.summary,
        "",
        "## Highlights",
    ];
    for (const h of input.highlights) {
        lines.push(`- ${h}`);
    }
    lines.push("");
    lines.push("## Sources");
    lines.push(`- Activities: ${input.activityRefs.join(", ")}`);
    lines.push(`- Observations: ${input.observationRefs.join(", ")}`);
    return lines.join("\n");
}
export function renderCuratedMemory(item) {
    const lines = [
        `# ${item.title}`,
        "",
        item.summary,
        "",
        `**Confidence**: ${item.confidence.toFixed(2)} | **TTL**: ${item.ttlClass}`,
        "",
        "## Sources",
    ];
    for (const ref of item.sourceRefs) {
        lines.push(`- ${ref}`);
    }
    return lines.join("\n");
}
export function renderProposal(proposal) {
    const lines = [
        `# Anchor Proposal — ${proposal.id}`,
        "",
        `**Target**: ${proposal.targetAssetId}`,
        `**Status**: ${proposal.status}`,
        "",
        "## Reason",
        proposal.reason,
        "",
        "## Diff",
        "```diff",
        proposal.proposedDiff,
        "```",
        "",
        "## Supporting Sources",
    ];
    for (const src of proposal.supportingSources) {
        lines.push(`- ${src}`);
    }
    return lines.join("\n");
}
export function applyDiff(original, diff) {
    const lines = original.split("\n");
    const diffLines = diff.split("\n").filter((l) => l.startsWith("+") || l.startsWith("-")).map((l) => l.substring(1));
    for (const d of diffLines) {
        if (d.startsWith("+")) {
            lines.push(d.substring(1));
        }
        else if (d.startsWith("-")) {
            const idx = lines.indexOf(d.substring(1));
            if (idx !== -1)
                lines.splice(idx, 1);
        }
    }
    return lines.join("\n");
}
export function buildCuratedAssetId(id) {
    return `curated:${id}`;
}
export function buildAnchorAssetId(name) {
    return `anchor:${name}`;
}
