import type { StateDatabase } from "../db/index.js";
import { type NewPolicyRecord, type PolicyRecord } from "../db/schema/index.js";
export declare class PolicyRepository {
    private readonly database;
    constructor(database: StateDatabase);
    upsert(record: NewPolicyRecord): Promise<void>;
    findByPlatformId(platformId: string): Promise<PolicyRecord | undefined>;
}
