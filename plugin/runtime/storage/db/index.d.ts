import { type Database } from "sql.js";
import { drizzle } from "drizzle-orm/sql-js";
import * as schema from "./schema/index.js";
export interface StateDatabase {
    sqlite: Database;
    db: ReturnType<typeof drizzle<typeof schema>>;
    schema: typeof schema;
    close(): void;
}
export declare function createStateDatabase(filename?: string): StateDatabase;
