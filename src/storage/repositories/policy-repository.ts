import { eq } from "drizzle-orm";

import type { StateDatabase } from "../db/index.js";
import { policyRecords, type NewPolicyRecord, type PolicyRecord } from "../db/schema/index.js";

export class PolicyRepository {
  constructor(private readonly database: StateDatabase) {}

  async upsert(record: NewPolicyRecord): Promise<void> {
    await this.database.db.insert(policyRecords).values(record).onConflictDoUpdate({
      target: policyRecords.platformId,
      set: record,
    });
  }

  async findByPlatformId(platformId: string): Promise<PolicyRecord | undefined> {
    return this.database.db.query.policyRecords.findFirst({
      where: eq(policyRecords.platformId, platformId),
    });
  }
}
