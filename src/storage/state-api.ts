import type { StateDatabase } from "./db/index.js";
import type { NewPolicyRecord, PolicyRecord } from "./db/schema/index.js";
import { AssetRepository } from "./repositories/asset-repository.js";
import { CredentialRepository } from "./repositories/credential-repository.js";
import { ProposalRepository } from "./repositories/proposal-repository.js";
import { ProvenanceRepository } from "./repositories/provenance-repository.js";
import { IntentCommitRepository } from "./repositories/intent-commit-repository.js";
import { PolicyRepository } from "./repositories/policy-repository.js";
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

type PolicyState = Omit<NewPolicyRecord, "updatedAt">;

export interface MemoryReadPort {
  loadQuietInputs(query: CurationInputQuery): Promise<CurationInputBundle>;
  loadPolicy(platformId: string): Promise<PolicyRecord | undefined>;
}

export interface MemoryWritePort {
  appendActivityLog(entry: ActivityLogWrite): Promise<AssetWriteAck>;
  appendObservation(entry: ObservationWrite): Promise<AssetWriteAck>;
  generateDailyReport(input: DailyReportInput): Promise<AssetWriteAck>;
  upsertCuratedMemory(item: CuratedMemoryWrite): Promise<AssetWriteAck>;
  savePolicy(input: PolicyState): Promise<void>;
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
    const policyRepository = new PolicyRepository(database);

    const dailyLogPipeline = createDailyLogPipeline(assetRepository, provenanceRepository);
    const quietInputLoader = createQuietInputLoader(assetRepository);

    this.read = {
      loadQuietInputs: (query: CurationInputQuery) => quietInputLoader.loadQuietInputs(query),
      loadPolicy: (platformId: string) => policyRepository.findByPlatformId(platformId),
    };

    this.write = {
      appendActivityLog: (entry: ActivityLogWrite) => dailyLogPipeline.appendActivityLog(entry),
      appendObservation: (entry: ObservationWrite) => dailyLogPipeline.appendObservation(entry),
      generateDailyReport: (input: DailyReportInput) => dailyLogPipeline.generateDailyReport(input),
      upsertCuratedMemory: (item: CuratedMemoryWrite) => dailyLogPipeline.upsertCuratedMemory(item),
      savePolicy: async (policy: PolicyState) => {
        await policyRepository.upsert({
          platformId: policy.platformId,
          socialDailyLimit: policy.socialDailyLimit,
          quietEnabled: policy.quietEnabled,
          updatedAt: new Date().toISOString(),
        });
      },
    };

    this.credentials = {
      loadCredentialContext: async (platformId: string) => {
        return credentialRepository.findByPlatformId(platformId);
      },
      saveCredentialContext: async (input: unknown) => {
        const ctx = input as Parameters<typeof credentialRepository.upsert>[0];
        await credentialRepository.upsert({
          ...ctx,
          updatedAt: ctx.updatedAt ?? new Date().toISOString(),
        });
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
