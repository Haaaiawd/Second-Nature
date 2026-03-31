import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema/index.js";
export interface ObservabilityDatabase {
    sqlite: Database.Database;
    db: ReturnType<typeof drizzle<typeof schema>>;
    schema: typeof schema;
    close(): void;
}
export declare function createObservabilityDatabase(filename?: string): ObservabilityDatabase;
