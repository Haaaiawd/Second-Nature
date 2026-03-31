import { eq } from "drizzle-orm";
import { policyRecords } from "../db/schema/index.js";
export class PolicyRepository {
    database;
    constructor(database) {
        this.database = database;
    }
    async upsert(record) {
        await this.database.db.insert(policyRecords).values(record).onConflictDoUpdate({
            target: policyRecords.platformId,
            set: record,
        });
    }
    async findByPlatformId(platformId) {
        return this.database.db.query.policyRecords.findFirst({
            where: eq(policyRecords.platformId, platformId),
        });
    }
}
