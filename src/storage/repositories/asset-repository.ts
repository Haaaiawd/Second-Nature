import { eq } from "drizzle-orm";

import type { StateDatabase } from "../db/index.js";
import { assetRegistry, type AssetRegistryRecord, type NewAssetRegistryRecord } from "../db/schema/index.js";

export class AssetRepository {
  constructor(private readonly database: StateDatabase) {}

  async upsert(record: NewAssetRegistryRecord): Promise<void> {
    await this.database.db.insert(assetRegistry).values(record).onConflictDoUpdate({
      target: assetRegistry.id,
      set: record,
    });
  }

  async findById(id: string): Promise<AssetRegistryRecord | undefined> {
    return this.database.db.query.assetRegistry.findFirst({
      where: eq(assetRegistry.id, id),
    });
  }
}
