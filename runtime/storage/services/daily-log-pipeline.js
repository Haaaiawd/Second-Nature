import { writeCanonicalArtifact, appendLine, hashFile, resolveDailyJournalPath, resolveDailyReportPath, resolveCuratedPath, serializeActivityLog, serializeObservation, renderDailyReport, renderCuratedMemory, buildJournalAssetId, buildReportAssetId, buildCuratedAssetId, } from "../memory/workspace/paths.js";
export class DailyLogPipeline {
    assetRepository;
    provenanceRepository;
    constructor(assetRepository, provenanceRepository) {
        this.assetRepository = assetRepository;
        this.provenanceRepository = provenanceRepository;
    }
    async appendActivityLog(entry) {
        const journalPath = resolveDailyJournalPath(entry.timestamp);
        const serialized = serializeActivityLog(entry);
        await appendLine(journalPath, serialized);
        const hash = await hashFile(journalPath);
        await this.assetRepository.upsert({
            id: buildJournalAssetId(journalPath),
            kind: "daily_journal",
            path: journalPath,
            hash,
            version: 1,
            layer: "daily_journal",
            lastIndexedAt: new Date().toISOString(),
        });
        if (entry.sourceRefs.length > 0) {
            await this.provenanceRepository.linkEntrySources(entry.id, entry.sourceRefs);
        }
        return { assetPath: journalPath, hash };
    }
    async appendObservation(entry) {
        const journalPath = resolveDailyJournalPath(entry.timestamp);
        const serialized = serializeObservation(entry);
        await appendLine(journalPath, serialized);
        const hash = await hashFile(journalPath);
        await this.assetRepository.upsert({
            id: buildJournalAssetId(journalPath),
            kind: "daily_journal",
            path: journalPath,
            hash,
            version: 1,
            layer: "daily_journal",
            lastIndexedAt: new Date().toISOString(),
        });
        return { assetPath: journalPath, hash };
    }
    async generateDailyReport(input) {
        const reportPath = resolveDailyReportPath(input.day);
        const content = renderDailyReport(input);
        await writeCanonicalArtifact(reportPath, content);
        const hash = await hashFile(reportPath);
        await this.assetRepository.upsert({
            id: buildReportAssetId(input.day),
            kind: "daily_report",
            path: reportPath,
            hash,
            version: 1,
            layer: "daily_journal",
            lastIndexedAt: new Date().toISOString(),
        });
        await this.provenanceRepository.linkEntrySources(buildReportAssetId(input.day), [
            ...input.activityRefs,
            ...input.observationRefs,
        ]);
        return { assetPath: reportPath, hash };
    }
    async upsertCuratedMemory(candidate) {
        const curatedPath = resolveCuratedPath(candidate.id);
        const content = renderCuratedMemory(candidate);
        await writeCanonicalArtifact(curatedPath, content);
        const hash = await hashFile(curatedPath);
        await this.assetRepository.upsert({
            id: buildCuratedAssetId(candidate.id),
            kind: "curated_memory",
            path: curatedPath,
            hash,
            version: 1,
            layer: "curated_memory",
            lastIndexedAt: new Date().toISOString(),
        });
        if (candidate.sourceRefs.length > 0) {
            await this.provenanceRepository.linkEntrySources(buildCuratedAssetId(candidate.id), candidate.sourceRefs);
        }
        return { assetPath: curatedPath, hash };
    }
}
export function createDailyLogPipeline(assetRepository, provenanceRepository) {
    return new DailyLogPipeline(assetRepository, provenanceRepository);
}
