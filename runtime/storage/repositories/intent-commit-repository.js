import { eq } from "drizzle-orm";
import { intentCommitRecords } from "../db/schema/index.js";
function mapToDomain(record) {
    return {
        id: record.id,
        intentId: record.intentId,
        decisionId: record.decisionId,
        checkpointId: record.checkpointId ?? undefined,
        state: record.state,
        outcomeRef: record.outcomeRef ?? undefined,
        metadata: record.metadataJson ? JSON.parse(record.metadataJson) : undefined,
        updatedAt: record.updatedAt,
    };
}
export class IntentCommitRepository {
    database;
    constructor(database) {
        this.database = database;
    }
    async create(record) {
        await this.database.db.insert(intentCommitRecords).values(record);
    }
    async update(record) {
        await this.database.db.insert(intentCommitRecords).values(record).onConflictDoUpdate({
            target: intentCommitRecords.id,
            set: record,
        });
    }
    async findByIntentId(intentId) {
        const record = await this.database.db.query.intentCommitRecords.findFirst({
            where: eq(intentCommitRecords.intentId, intentId),
        });
        return record ? mapToDomain(record) : undefined;
    }
}
