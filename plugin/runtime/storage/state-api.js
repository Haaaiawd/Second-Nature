import { AssetRepository } from "./repositories/asset-repository.js";
import { CredentialRepository } from "./repositories/credential-repository.js";
import { ProposalRepository } from "./repositories/proposal-repository.js";
import { ProvenanceRepository } from "./repositories/provenance-repository.js";
import { IntentCommitRepository } from "./repositories/intent-commit-repository.js";
import { PolicyRepository } from "./repositories/policy-repository.js";
import { createDailyLogPipeline, } from "./services/daily-log-pipeline.js";
import { createQuietInputLoader, } from "./services/quiet-input-loader.js";
import { createPersonaCandidateLoader } from "./services/persona-candidate-loader.js";
export class DefaultStateAPI {
    database;
    read;
    write;
    credentials;
    commits;
    provenance;
    constructor(database) {
        this.database = database;
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
            loadQuietInputs: (query) => quietInputLoader.loadQuietInputs(query),
            loadPolicy: async (platformId) => {
                const record = await policyRepository.findByPlatformId(platformId);
                if (!record)
                    return undefined;
                const r = record;
                return {
                    platformId: r.platformId ?? r.platform_id ?? platformId,
                    socialDailyLimit: r.socialDailyLimit ?? r.social_daily_limit ?? 0,
                    quietEnabled: r.quietEnabled ?? Boolean(r.quiet_enabled),
                    outreachDailyBudget: r.outreachDailyBudget ?? r.outreach_daily_budget ?? 2,
                    updatedAt: r.updatedAt ?? r.updated_at ?? "",
                };
            },
            loadPersonaCandidates: (sceneContext) => personaCandidateLoader.loadPersonaCandidates(sceneContext),
        };
        this.write = {
            appendActivityLog: (entry) => dailyLogPipeline.appendActivityLog(entry),
            appendObservation: (entry) => dailyLogPipeline.appendObservation(entry),
            generateDailyReport: (input) => dailyLogPipeline.generateDailyReport(input),
            upsertCuratedMemory: (item) => dailyLogPipeline.upsertCuratedMemory(item),
            savePolicy: async (policy) => {
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
            loadCredentialContext: async (platformId) => {
                const record = await credentialRepository.findByPlatformId(platformId);
                if (!record)
                    return null;
                const r = record;
                return {
                    platformId: (r.platformId ?? r.platform_id),
                    credentialType: (r.credentialType ?? r.credential_type),
                    encryptedValue: (r.encryptedValue ?? r.encrypted_value),
                    status: (r.status ?? ""),
                    verificationCode: (r.verificationCode ?? r.verification_code ?? null),
                    challengeText: (r.challengeText ?? r.challenge_text ?? null),
                    expiresAt: (r.expiresAt ?? r.expires_at ?? null),
                    attemptsRemaining: (r.attemptsRemaining ?? r.attempts_remaining ?? null),
                    updatedAt: (r.updatedAt ?? r.updated_at ?? ""),
                };
            },
            saveCredentialContext: async (input) => {
                const ctx = input;
                await credentialRepository.upsert({
                    ...ctx,
                    updatedAt: ctx.updatedAt ?? new Date().toISOString(),
                });
            },
        };
        this.commits = {
            loadIntentCommitRecord: async (intentId) => {
                return intentCommitRepository.findByIntentId(intentId);
            },
        };
        this.provenance = {
            explainProvenance: async (assetId) => {
                return provenanceRepository.traceAsset(assetId);
            },
        };
    }
}
export function createStateAPI(database) {
    return new DefaultStateAPI(database);
}
