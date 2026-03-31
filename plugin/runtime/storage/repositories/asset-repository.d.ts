import type { StateDatabase } from "../db/index.js";
import { type AssetRegistryRecord, type NewAssetRegistryRecord } from "../db/schema/index.js";
export declare class AssetRepository {
    private readonly database;
    constructor(database: StateDatabase);
    upsert(record: NewAssetRegistryRecord): Promise<void>;
    findById(id: string): Promise<AssetRegistryRecord | undefined>;
}
