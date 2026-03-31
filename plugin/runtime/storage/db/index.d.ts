import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema/index.js";
export interface StateDatabase {
    sqlite: Database.Database;
    db: ReturnType<typeof drizzle<typeof schema>>;
    schema: typeof schema;
    close(): void;
}
export declare function createStateDatabase(filename?: string): StateDatabase;
