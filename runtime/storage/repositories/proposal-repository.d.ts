import type { StateDatabase } from "../db/index.js";
import { type NewProposalRecord, type ProposalRecord } from "../db/schema/index.js";
export declare class ProposalRepository {
    private readonly database;
    constructor(database: StateDatabase);
    create(record: NewProposalRecord): Promise<void>;
    findById(id: string): Promise<ProposalRecord | undefined>;
    updateStatus(id: string, status: string, afterHash?: string): Promise<void>;
}
