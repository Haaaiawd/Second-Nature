import type { StateDatabase } from "./db/index.js";
import type { NewPolicyRecord, PolicyRecord } from "./db/schema/index.js";
import { type ActivityLogWrite, type ObservationWrite, type DailyReportInput, type CuratedMemoryWrite, type AssetWriteAck } from "./services/daily-log-pipeline.js";
import { type CurationInputQuery, type CurationInputBundle } from "./services/quiet-input-loader.js";
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
export declare class DefaultStateAPI implements StateAPI {
    private readonly database;
    readonly read: MemoryReadPort;
    readonly write: MemoryWritePort;
    readonly credentials: CredentialContextPort;
    readonly commits: IntentCommitPort;
    readonly provenance: ProvenancePort;
    constructor(database: StateDatabase);
}
export declare function createStateAPI(database: StateDatabase): StateAPI;
export {};
