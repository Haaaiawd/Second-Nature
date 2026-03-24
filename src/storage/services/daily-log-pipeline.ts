import type { StateDatabase } from "../db/index.js";
import type { AssetRepository } from "../repositories/asset-repository.js";
import type { ProvenanceRepository } from "../repositories/provenance-repository.js";
import {
  writeCanonicalArtifact,
  appendLine,
  hashFile,
  resolveDailyJournalPath,
  resolveDailyReportPath,
  resolveCuratedPath,
  serializeActivityLog,
  serializeObservation,
  renderDailyReport,
  renderCuratedMemory,
  buildJournalAssetId,
  buildReportAssetId,
  buildCuratedAssetId,
} from "../memory/workspace/paths.js";

export interface ActivityLogWrite {
  id: string;
  timestamp: string;
  platform?: string;
  kind: "browse" | "action" | "failure" | "task" | "heartbeat";
  content: string;
  sourceRefs: string[];
}

export interface ObservationWrite {
  id: string;
  timestamp: string;
  summary: string;
  mood?: string;
  sourceRefs: string[];
}

export interface DailyReportInput {
  day: string;
  summary: string;
  highlights: string[];
  activityRefs: string[];
  observationRefs: string[];
}

export interface CuratedMemoryWrite {
  id: string;
  title: string;
  summary: string;
  confidence: number;
  ttlClass: "short" | "medium" | "long";
  sourceRefs: string[];
  supersedes?: string[];
}

export interface AssetWriteAck {
  assetPath: string;
  hash: string;
}

export class DailyLogPipeline {
  constructor(
    private readonly assetRepository: AssetRepository,
    private readonly provenanceRepository: ProvenanceRepository
  ) {}

  async appendActivityLog(entry: ActivityLogWrite): Promise<AssetWriteAck> {
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

  async appendObservation(entry: ObservationWrite): Promise<AssetWriteAck> {
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

  async generateDailyReport(input: DailyReportInput): Promise<AssetWriteAck> {
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

  async upsertCuratedMemory(candidate: CuratedMemoryWrite): Promise<AssetWriteAck> {
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
      await this.provenanceRepository.linkEntrySources(
        buildCuratedAssetId(candidate.id),
        candidate.sourceRefs
      );
    }

    return { assetPath: curatedPath, hash };
  }
}

export function createDailyLogPipeline(
  assetRepository: AssetRepository,
  provenanceRepository: ProvenanceRepository
): DailyLogPipeline {
  return new DailyLogPipeline(assetRepository, provenanceRepository);
}