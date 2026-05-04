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
        const row = await this.database.db.query.credentialRecords.findFirst({
            where: eq(credentialRecords.platformId, platformId),
        });
        if (row == null) {
            return undefined;
        }
        const r = row;
        const pid = (r.platformId ?? r.platform_id);
        const enc = (r.encryptedValue ?? r.encrypted_value);
        // sql.js + Drizzle: no-match can still return a "shell" row (keys present, values undefined).
        if (pid == null || pid === "" || enc == null || enc === "") {
            return undefined;
        }
        return row;
    }
}
