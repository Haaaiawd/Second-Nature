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
    const row = await this.database.db.query.credentialRecords.findFirst({
      where: eq(credentialRecords.platformId, platformId),
    });
    if (row == null) {
      return undefined;
    }
    const r = row as Record<string, unknown>;
    const pid = (r.platformId ?? r.platform_id) as string | undefined;
    const enc = (r.encryptedValue ?? r.encrypted_value) as string | undefined;
    // sql.js + Drizzle: no-match can still return a "shell" row (keys present, values undefined).
    if (pid == null || pid === "" || enc == null || enc === "") {
      return undefined;
    }
    return row;
  }
}
