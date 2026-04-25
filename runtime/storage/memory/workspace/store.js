import { resolveDailyJournalPath, resolveDailyReportPath, resolveCuratedPath, resolveProposalPath, resolveAnchorPath, appendLine, readText, hashFile, writeCanonicalArtifact, buildJournalAssetId, buildReportAssetId, buildCuratedAssetId, ASSET_CONFIG } from "./paths.js";
import { assetRegistry } from "../../db/schema/index.js";
export function createWorkspaceArtifactStore(db) {
    const indexStore = {
        async upsertAsset(record) {
            await db.insert(assetRegistry).values(record).onConflictDoUpdate({
                target: assetRegistry.id,
                set: record,
            });
        },
        async findSimilarCuratedMemory(candidate) {
            return undefined;
        },
        async upsertCurated(_candidate) { },
        async registerProposal(_proposal) { },
        async markProposalApplied(_proposalId, _afterHash) { },
        async bumpAssetVersion(_assetId, _hash) { },
    };
    return {
        async appendActivityLog(entry) {
            const journalPath = resolveDailyJournalPath(entry.timestamp);
            const serialized = `- [${entry.timestamp}] ${entry.platform ? `[${entry.platform}] ` : ""}${entry.kind}: ${entry.content}${entry.sourceRefs.length > 0 ? ` (refs: ${entry.sourceRefs.join(", ")})` : ""}`;
            await appendLine(journalPath, serialized);
            const hashVal = await hashFile(journalPath);
            const assetRecord = {
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
        async appendObservation(entry) {
            const journalPath = resolveDailyJournalPath(entry.timestamp);
            const serialized = `- [${entry.timestamp}] ${entry.summary}${entry.mood ? ` (${entry.mood})` : ""}${entry.sourceRefs.length > 0 ? ` [${entry.sourceRefs.join(", ")}]` : ""}`;
            await appendLine(journalPath, serialized);
            const hashVal = await hashFile(journalPath);
            const assetRecord = {
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
        async generateDailyReport(input) {
            const reportPath = resolveDailyReportPath(input.day);
            const lines = [
                `# Daily Report — ${input.day}`,
                "",
                "## Summary",
                input.summary,
                "",
                "## Highlights",
            ];
            for (const h of input.highlights)
                lines.push(`- ${h}`);
            lines.push("");
            lines.push("## Sources");
            lines.push(`- Activities: ${input.activityRefs.join(", ")}`);
            lines.push(`- Observations: ${input.observationRefs.join(", ")}`);
            const content = lines.join("\n");
            await writeCanonicalArtifact(reportPath, content);
            const hashVal = await hashFile(reportPath);
            const assetRecord = {
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
        async upsertCuratedMemory(candidate) {
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
            for (const ref of candidate.sourceRefs)
                lines.push(`- ${ref}`);
            const content = lines.join("\n");
            await writeCanonicalArtifact(curatedPath, content);
            const hashVal = await hashFile(curatedPath);
            const assetRecord = {
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
        async proposeAnchorWrite(proposal) {
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
            for (const src of proposal.supportingSources)
                lines.push(`- ${src}`);
            const content = lines.join("\n");
            await writeCanonicalArtifact(proposalPath, content);
            await indexStore.registerProposal({ ...proposal, status: "draft" });
            return { proposalPath, status: proposal.status };
        },
        async loadAnchorSnapshot() {
            const snapshot = {};
            for (const name of ASSET_CONFIG.anchorAssets) {
                const anchorPath = resolveAnchorPath(name);
                snapshot[name] = await readText(anchorPath);
            }
            return snapshot;
        },
    };
}
