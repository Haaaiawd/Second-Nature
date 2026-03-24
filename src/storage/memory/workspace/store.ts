import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";

import { ensureDirectory, resolveDailyJournalPath, resolveDailyReportPath, resolveCuratedPath, resolveProposalPath, resolveAnchorPath, appendLine, readText, hashFile, writeCanonicalArtifact, buildJournalAssetId, buildReportAssetId, buildCuratedAssetId, buildAnchorAssetId, ASSET_CONFIG } from "./paths.js";
import type { ActivityLogWrite, ObservationWrite, DailyReportInput, CuratedMemoryWrite, AnchorWriteProposal } from "./types.js";
import { assetRegistry, type NewAssetRegistryRecord } from "../../db/schema/index.js";
import type { StateDatabase } from "../../db/index.js";

export interface WorkspaceArtifactStore {
  appendActivityLog(entry: ActivityLogWrite): Promise<{ assetPath: string; hash: string }>;
  appendObservation(entry: ObservationWrite): Promise<{ assetPath: string; hash: string }>;
  generateDailyReport(input: DailyReportInput): Promise<{ assetPath: string; hash: string }>;
  upsertCuratedMemory(candidate: CuratedMemoryWrite): Promise<{ assetPath: string; hash: string }>;
  proposeAnchorWrite(proposal: AnchorWriteProposal): Promise<{ proposalPath: string; status: string }>;
  loadAnchorSnapshot(): Promise<Record<string, string>>;
}

export function createWorkspaceArtifactStore(db: StateDatabase["db"]): WorkspaceArtifactStore {
  const indexStore = {
    async upsertAsset(record: NewAssetRegistryRecord): Promise<void> {
      await db.insert(assetRegistry).values(record).onConflictDoUpdate({
        target: assetRegistry.id,
        set: record,
      });
    },
    async findSimilarCuratedMemory(candidate: CuratedMemoryWrite): Promise<CuratedMemoryWrite | undefined> {
      return undefined;
    },
    async upsertCurated(_candidate: CuratedMemoryWrite): Promise<void> {},
    async registerProposal(_proposal: AnchorWriteProposal): Promise<void> {},
    async markProposalApplied(_proposalId: string, _afterHash: string): Promise<void> {},
    async bumpAssetVersion(_assetId: string, _hash: string): Promise<void> {},
  };

  return {
    async appendActivityLog(entry: ActivityLogWrite) {
      const journalPath = resolveDailyJournalPath(entry.timestamp);
      const serialized = `- [${entry.timestamp}] ${entry.platform ? `[${entry.platform}] ` : ""}${entry.kind}: ${entry.content}${entry.sourceRefs.length > 0 ? ` (refs: ${entry.sourceRefs.join(", ")})` : ""}`;
      
      await appendLine(journalPath, serialized);
      const hashVal = await hashFile(journalPath);

      const assetRecord: NewAssetRegistryRecord = {
        id: buildJournalAssetId(journalPath),
        kind: "daily_journal",
        path: journalPath,
        hash: hashVal,
        version: 1,
        layer: "daily_journal",
        lastIndexedAt: new Date().toISOString(),
      };
      await indexStore.upsertAsset(assetRecord);

      return { assetPath: journalPath, hash: hashVal };
    },

    async appendObservation(entry: ObservationWrite) {
      const journalPath = resolveDailyJournalPath(entry.timestamp);
      const serialized = `- [${entry.timestamp}] ${entry.summary}${entry.mood ? ` (${entry.mood})` : ""}${entry.sourceRefs.length > 0 ? ` [${entry.sourceRefs.join(", ")}]` : ""}`;
      
      await appendLine(journalPath, serialized);
      const hashVal = await hashFile(journalPath);

      const assetRecord: NewAssetRegistryRecord = {
        id: buildJournalAssetId(journalPath),
        kind: "daily_journal",
        path: journalPath,
        hash: hashVal,
        version: 1,
        layer: "daily_journal",
        lastIndexedAt: new Date().toISOString(),
      };
      await indexStore.upsertAsset(assetRecord);

      return { assetPath: journalPath, hash: hashVal };
    },

    async generateDailyReport(input: DailyReportInput) {
      const reportPath = resolveDailyReportPath(input.day);
      const lines = [
        `# Daily Report — ${input.day}`,
        "",
        "## Summary",
        input.summary,
        "",
        "## Highlights",
      ];
      for (const h of input.highlights) lines.push(`- ${h}`);
      lines.push("");
      lines.push("## Sources");
      lines.push(`- Activities: ${input.activityRefs.join(", ")}`);
      lines.push(`- Observations: ${input.observationRefs.join(", ")}`);
      const content = lines.join("\n");

      await writeCanonicalArtifact(reportPath, content);
      const hashVal = await hashFile(reportPath);

      const assetRecord: NewAssetRegistryRecord = {
        id: buildReportAssetId(input.day),
        kind: "daily_report",
        path: reportPath,
        hash: hashVal,
        version: 1,
        layer: "daily_journal",
        lastIndexedAt: new Date().toISOString(),
      };
      await indexStore.upsertAsset(assetRecord);

      return { assetPath: reportPath, hash: hashVal };
    },

    async upsertCuratedMemory(candidate: CuratedMemoryWrite) {
      const curatedPath = resolveCuratedPath(candidate.id);
      const lines = [
        `# ${candidate.title}`,
        "",
        candidate.summary,
        "",
        `**Confidence**: ${candidate.confidence.toFixed(2)} | **TTL**: ${candidate.ttlClass}`,
        "",
        "## Sources",
      ];
      for (const ref of candidate.sourceRefs) lines.push(`- ${ref}`);
      const content = lines.join("\n");

      await writeCanonicalArtifact(curatedPath, content);
      const hashVal = await hashFile(curatedPath);

      const assetRecord: NewAssetRegistryRecord = {
        id: buildCuratedAssetId(candidate.id),
        kind: "curated_memory",
        path: curatedPath,
        hash: hashVal,
        version: 1,
        layer: "curated_memory",
        lastIndexedAt: new Date().toISOString(),
      };
      await indexStore.upsertAsset(assetRecord);

      return { assetPath: curatedPath, hash: hashVal };
    },

    async proposeAnchorWrite(proposal: AnchorWriteProposal) {
      if (!proposal.supportingSources.length) {
        throw new Error("anchor_proposal_requires_sources");
      }
      if (proposal.confidence < 0.8) {
        throw new Error("anchor_proposal_confidence_too_low");
      }

      const proposalPath = resolveProposalPath(proposal.id);
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
      for (const src of proposal.supportingSources) lines.push(`- ${src}`);
      const content = lines.join("\n");

      await writeCanonicalArtifact(proposalPath, content);
      await indexStore.registerProposal({ ...proposal, status: "draft" });

      return { proposalPath, status: proposal.status };
    },

    async loadAnchorSnapshot(): Promise<Record<string, string>> {
      const snapshot: Record<string, string> = {};
      for (const name of ASSET_CONFIG.anchorAssets) {
        const anchorPath = resolveAnchorPath(name);
        snapshot[name] = await readText(anchorPath);
      }
      return snapshot;
    },
  };
}