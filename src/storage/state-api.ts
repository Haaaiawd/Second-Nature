import type { StateDatabase } from "./db/index.js";
import { AssetRepository } from "./repositories/asset-repository.js";
import { CredentialRepository } from "./repositories/credential-repository.js";
import { ProposalRepository } from "./repositories/proposal-repository.js";
import { ProvenanceRepository } from "./repositories/provenance-repository.js";
import { IntentCommitRepository } from "./repositories/intent-commit-repository.js";
import {
  createDailyLogPipeline,
  type ActivityLogWrite,
  type ObservationWrite,
  type DailyReportInput,
  type CuratedMemoryWrite,
  type AssetWriteAck,
} from "./services/daily-log-pipeline.js";
import {
  createQuietInputLoader,
  type CurationInputQuery,
  type CurationInputBundle,
} from "./services/quiet-input-loader.js";

export interface MemoryReadPort {
  loadQuietInputs(query: CurationInputQuery): Promise<CurationInputBundle>;
}

export interface MemoryWritePort {
  appendActivityLog(entry: ActivityLogWrite): Promise<AssetWriteAck>;
  appendObservation(entry: ObservationWrite): Promise<AssetWriteAck>;
  generateDailyReport(input: DailyReportInput): Promise<AssetWriteAck>;
  upsertCuratedMemory(item: CuratedMemoryWrite): Promise<AssetWriteAck>;
}

export interface CredentialContextPort {
  loadCredentialContext(platformId: string): Promise<unknown>;
  saveCredentialContext(input: unknown): Promise<void>;
}

export interface IntentCommitPort {
  loadIntentCommitRecord(intentId: string): Promise<unknown>;
}

export interface ProvenancePort {
  explainProvenance(assetId: string): Promise<unknown>;
}

export interface StateAPI {
  readonly read: MemoryReadPort;
  readonly write: MemoryWritePort;
  readonly credentials: CredentialContextPort;
  readonly commits: IntentCommitPort;
  readonly provenance: ProvenancePort;
}

export class DefaultStateAPI implements StateAPI {
  public readonly read: MemoryReadPort;
  public readonly write: MemoryWritePort;
  public readonly credentials: CredentialContextPort;
  public readonly commits: IntentCommitPort;
  public readonly provenance: ProvenancePort;

  constructor(private readonly database: StateDatabase) {
    const assetRepository = new AssetRepository(database);
    const credentialRepository = new CredentialRepository(database);
    const proposalRepository = new ProposalRepository(database);
    const provenanceRepository = new ProvenanceRepository(database);
    const intentCommitRepository = new IntentCommitRepository(database);

    const dailyLogPipeline = createDailyLogPipeline(assetRepository, provenanceRepository);
    const quietInputLoader = createQuietInputLoader(assetRepository);

    this.read = {
      loadQuietInputs: (query: CurationInputQuery) => quietInputLoader.loadQuietInputs(query),
    };

    this.write = {
      appendActivityLog: (entry: ActivityLogWrite) => dailyLogPipeline.appendActivityLog(entry),
      appendObservation: (entry: ObservationWrite) => dailyLogPipeline.appendObservation(entry),
      generateDailyReport: (input: DailyReportInput) => dailyLogPipeline.generateDailyReport(input),
      upsertCuratedMemory: (item: CuratedMemoryWrite) => dailyLogPipeline.upsertCuratedMemory(item),
    };

    this.credentials = {
      loadCredentialContext: async (platformId: string) => {
        return credentialRepository.findByPlatformId(platformId);
      },
      saveCredentialContext: async (input: unknown) => {
        const ctx = input as Parameters<typeof credentialRepository.upsert>[0];
        await credentialRepository.upsert(ctx);
      },
    };

    this.commits = {
      loadIntentCommitRecord: async (intentId: string) => {
        return intentCommitRepository.findByIntentId(intentId);
      },
    };

    this.provenance = {
      explainProvenance: async (assetId: string) => {
        return provenanceRepository.traceAsset(assetId);
      },
    };
  }
}

export function createStateAPI(database: StateDatabase): StateAPI {
  return new DefaultStateAPI(database);
}