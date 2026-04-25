import type { StateDatabase } from "../db/index.js";
import { type CredentialRecord, type NewCredentialRecord } from "../db/schema/index.js";
export declare class CredentialRepository {
    private readonly database;
    constructor(database: StateDatabase);
    upsert(record: NewCredentialRecord): Promise<void>;
    findByPlatformId(platformId: string): Promise<CredentialRecord | undefined>;
}
