import { eq } from "drizzle-orm";

import type { IntentCommitRecord } from "../../shared/types/index.js";
import type { StateDatabase } from "../db/index.js";
import { intentCommitRecords, type IntentCommitDbRecord, type NewIntentCommitDbRecord } from "../db/schema/index.js";

function mapToDomain(record: IntentCommitDbRecord): IntentCommitRecord {
  return {
    id: record.id,
    intentId: record.intentId,
    decisionId: record.decisionId,
    checkpointId: record.checkpointId ?? undefined,
    state: record.state as IntentCommitRecord["state"],
    outcomeRef: record.outcomeRef ?? undefined,
    metadata: record.metadataJson ? (JSON.parse(record.metadataJson) as Record<string, unknown>) : undefined,
    updatedAt: record.updatedAt,
  };
}

export class IntentCommitRepository {
  constructor(private readonly database: StateDatabase) {}

  async create(record: NewIntentCommitDbRecord): Promise<void> {
    await this.database.db.insert(intentCommitRecords).values(record);
  }

  async update(record: NewIntentCommitDbRecord): Promise<void> {
    await this.database.db.insert(intentCommitRecords).values(record).onConflictDoUpdate({
      target: intentCommitRecords.id,
      set: record,
    });
  }

  async findByIntentId(intentId: string): Promise<IntentCommitRecord | undefined> {
    const record = await this.database.db.query.intentCommitRecords.findFirst({
      where: eq(intentCommitRecords.intentId, intentId),
    });

    return record ? mapToDomain(record) : undefined;
  }
}
