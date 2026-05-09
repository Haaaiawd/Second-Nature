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
import { createPersonaCandidateLoader } from "./services/persona-candidate-loader.js";
import { encryptCredentialAtRest, isCredentialCiphertext } from "./services/credential-vault.js";
import type { PersonaCandidate, SceneContext } from "../guidance/types.js";

type PolicyState = Omit<NewPolicyRecord, "updatedAt">;

export interface MemoryReadPort {
  loadQuietInputs(query: CurationInputQuery): Promise<CurationInputBundle>;
  loadPolicy(platformId: string): Promise<PolicyRecord | undefined>;
  loadPersonaCandidates(sceneContext: SceneContext): Promise<PersonaCandidate[]>;
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
    const personaCandidateLoader = createPersonaCandidateLoader();

    this.read = {
      loadQuietInputs: (query: CurationInputQuery) => quietInputLoader.loadQuietInputs(query),
      loadPolicy: async (platformId: string) => {
        const record = await policyRepository.findByPlatformId(platformId);
        if (!record) return undefined;
        const r = record as unknown as {
          platformId?: string;
          platform_id?: string;
          socialDailyLimit?: number;
          social_daily_limit?: number;
          quietEnabled?: boolean;
          quiet_enabled?: number;
          outreachDailyBudget?: number;
          outreach_daily_budget?: number;
          updatedAt?: string;
          updated_at?: string;
        };
        return {
          platformId: r.platformId ?? r.platform_id ?? platformId,
          socialDailyLimit: r.socialDailyLimit ?? r.social_daily_limit ?? 0,
          quietEnabled: r.quietEnabled ?? Boolean(r.quiet_enabled),
          outreachDailyBudget: r.outreachDailyBudget ?? r.outreach_daily_budget ?? 2,
          updatedAt: r.updatedAt ?? r.updated_at ?? "",
        };
      },
      loadPersonaCandidates: (sceneContext: SceneContext) => personaCandidateLoader.loadPersonaCandidates(sceneContext),
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
          outreachDailyBudget: policy.outreachDailyBudget ?? 2,
          updatedAt: new Date().toISOString(),
        });
      },
    };

    this.credentials = {
      loadCredentialContext: async (platformId: string) => {
        const record = await credentialRepository.findByPlatformId(platformId);
        if (!record) return null;
        const r = record as Record<string, unknown>;
        return {
          platformId: (r.platformId ?? r.platform_id) as string,
          credentialType: (r.credentialType ?? r.credential_type) as string,
          encryptedValue: (r.encryptedValue ?? r.encrypted_value) as string,
          status: (r.status ?? "") as string,
          verificationCode: (r.verificationCode ?? r.verification_code ?? null) as string | null,
          challengeText: (r.challengeText ?? r.challenge_text ?? null) as string | null,
          expiresAt: (r.expiresAt ?? r.expires_at ?? null) as string | null,
          attemptsRemaining: (r.attemptsRemaining ?? r.attempts_remaining ?? null) as number | null,
          updatedAt: (r.updatedAt ?? r.updated_at ?? "") as string,
        };
      },
      saveCredentialContext: async (input: unknown) => {
        const ctx = input as Parameters<typeof credentialRepository.upsert>[0];
        const raw = ctx.encryptedValue != null ? String(ctx.encryptedValue) : "";
        const encryptedValue =
          !raw || isCredentialCiphertext(raw) ? raw : encryptCredentialAtRest(raw);
        await credentialRepository.upsert({
          ...ctx,
          encryptedValue,
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
