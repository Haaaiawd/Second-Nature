import { eq } from "drizzle-orm";
import { credentialRecords } from "../db/schema/index.js";
export class CredentialRepository {
    database;
    constructor(database) {
        this.database = database;
    }
    async upsert(record) {
        await this.database.db.insert(credentialRecords).values(record).onConflictDoUpdate({
            target: credentialRecords.platformId,
            set: record,
        });
    }
    async findByPlatformId(platformId) {
        return this.database.db.query.credentialRecords.findFirst({
            where: eq(credentialRecords.platformId, platformId),
        });
    }
}
