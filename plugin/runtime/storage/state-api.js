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
            loadPolicy: (platformId) => policyRepository.findByPlatformId(platformId),
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
                    updatedAt: new Date().toISOString(),
                });
            },
        };
        this.credentials = {
            loadCredentialContext: async (platformId) => {
                return credentialRepository.findByPlatformId(platformId);
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
