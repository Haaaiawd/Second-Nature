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

  async updateStatus(id: string, status: string, afterHash?: string): Promise<void> {
    await this.database.db
      .update(proposalRecords)
      .set({
        status,
        afterHash: afterHash ?? undefined,
        appliedAt: status === "applied" ? new Date().toISOString() : undefined,
      })
      .where(eq(proposalRecords.id, id));
  }
}
