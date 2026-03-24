import { eq } from "drizzle-orm";

import type { StateDatabase } from "../db/index.js";
import { credentialRecords, type CredentialRecord, type NewCredentialRecord } from "../db/schema/index.js";

export class CredentialRepository {
  constructor(private readonly database: StateDatabase) {}

  async upsert(record: NewCredentialRecord): Promise<void> {
    await this.database.db.insert(credentialRecords).values(record).onConflictDoUpdate({
      target: credentialRecords.platformId,
      set: record,
    });
  }

  async findByPlatformId(platformId: string): Promise<CredentialRecord | undefined> {
    return this.database.db.query.credentialRecords.findFirst({
      where: eq(credentialRecords.platformId, platformId),
    });
  }
}
