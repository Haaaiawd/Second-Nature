import type { IntentCommitRecord } from "../../shared/types/index.js";
import type { StateDatabase } from "../db/index.js";
import { type NewIntentCommitDbRecord } from "../db/schema/index.js";
export declare class IntentCommitRepository {
    private readonly database;
    constructor(database: StateDatabase);
    create(record: NewIntentCommitDbRecord): Promise<void>;
    update(record: NewIntentCommitDbRecord): Promise<void>;
    findByIntentId(intentId: string): Promise<IntentCommitRecord | undefined>;
}
