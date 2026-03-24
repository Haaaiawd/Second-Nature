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
} as const;

export async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export function resolveDailyJournalPath(timestamp: string): string {
  const date = timestamp.split("T")[0];
  return path.join(ASSET_CONFIG.workspaceRoot, ASSET_CONFIG.journalsDir, `${date}.md`);
}

export function resolveDailyReportPath(day: string): string {
  return path.join(ASSET_CONFIG.workspaceRoot, ASSET_CONFIG.reportsDir, `${day}.md`);
}

export function resolveCuratedPath(id: string): string {
  return path.join(ASSET_CONFIG.workspaceRoot, ASSET_CONFIG.curatedDir, `${id}.md`);
}

export function resolveProposalPath(proposalId: string): string {
  return path.join(ASSET_CONFIG.workspaceRoot, ASSET_CONFIG.proposalsDir, `${proposalId}.md`);
}

export function resolveAnchorPath(assetName: string): string {
  return path.join(ASSET_CONFIG.workspaceRoot, assetName);
}

export async function writeCanonicalArtifact(filePath: string, content: string): Promise<void> {
  await ensureDirectory(path.dirname(filePath));
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, content, "utf-8");
  await fs.rename(tempPath, filePath);
}

export async function appendLine(filePath: string, line: string): Promise<void> {
  await ensureDirectory(path.dirname(filePath));
  const exists = await fileExists(filePath);
  const prefix = exists ? "\n" : "";
  await fs.appendFile(filePath, `${prefix}${line}`, "utf-8");
}

export async function readText(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return "";
  }
}

export async function hashFile(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath);
    return crypto.createHash("sha256").update(content).digest("hex");
  } catch {
    return "";
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function buildJournalAssetId(filePath: string): string {
  return `journal:${path.basename(filePath, ".md")}`;
}

export function buildReportAssetId(day: string): string {
  return `report:${day}`;
}

export function serializeActivityLog(entry: { id: string; timestamp: string; platform?: string; kind: string; content: string; sourceRefs: string[] }): string {
  const meta = entry.platform ? `[${entry.platform}] ` : "";
  const sources = entry.sourceRefs.length > 0 ? ` (refs: ${entry.sourceRefs.join(", ")})` : "";
  return `- [${entry.timestamp}] ${meta}${entry.kind}: ${entry.content}${sources}`;
}

export function serializeObservation(entry: { id: string; timestamp: string; summary: string; mood?: string; sourceRefs: string[] }): string {
  const mood = entry.mood ? ` (${entry.mood})` : "";
  const sources = entry.sourceRefs.length > 0 ? ` [${entry.sourceRefs.join(", ")}]` : "";
  return `- [${entry.timestamp}] ${entry.summary}${mood}${sources}`;
}

export function renderDailyReport(input: { day: string; summary: string; highlights: string[]; activityRefs: string[]; observationRefs: string[] }): string {
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

export function renderCuratedMemory(item: { id: string; title: string; summary: string; confidence: number; ttlClass: string; sourceRefs: string[] }): string {
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

export function renderProposal(proposal: { id: string; targetAssetId: string; proposedDiff: string; reason: string; supportingSources: string[]; status: string }): string {
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

export function applyDiff(original: string, diff: string): string {
  const lines = original.split("\n");
  const diffLines = diff.split("\n").filter((l) => l.startsWith("+") || l.startsWith("-")).map((l) => l.substring(1));
  
  for (const d of diffLines) {
    if (d.startsWith("+")) {
      lines.push(d.substring(1));
    } else if (d.startsWith("-")) {
      const idx = lines.indexOf(d.substring(1));
      if (idx !== -1) lines.splice(idx, 1);
    }
  }
  return lines.join("\n");
}

export function buildCuratedAssetId(id: string): string {
  return `curated:${id}`;
}

export function buildAnchorAssetId(name: string): string {
  return `anchor:${name}`;
}