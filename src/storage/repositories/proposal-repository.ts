import { eq } from "drizzle-orm";

import type { StateDatabase } from "../db/index.js";
import { proposalRecords, type NewProposalRecord, type ProposalRecord } from "../db/schema/index.js";

export class ProposalRepository {
  constructor(private readonly database: StateDatabase) {}

  async create(record: NewProposalRecord): Promise<void> {
    await this.database.db.insert(proposalRecords).values(record);
  }

  async findById(id: string): Promise<ProposalRecord | undefined> {
    return this.database.db.query.proposalRecords.findFirst({
      where: eq(proposalRecords.id, id),
    });
  }
}
