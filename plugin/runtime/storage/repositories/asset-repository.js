import { eq } from "drizzle-orm";
import { assetRegistry } from "../db/schema/index.js";
export class AssetRepository {
    database;
    constructor(database) {
        this.database = database;
    }
    async upsert(record) {
        await this.database.db.insert(assetRegistry).values(record).onConflictDoUpdate({
            target: assetRegistry.id,
            set: record,
        });
    }
    async findById(id) {
        return this.database.db.query.assetRegistry.findFirst({
            where: eq(assetRegistry.id, id),
        });
    }
}
