import { type Database } from "sql.js";
import { drizzle } from "drizzle-orm/sql-js";
import * as schema from "./schema/index.js";
export interface ObservabilityDatabase {
    sqlite: Database;
    db: ReturnType<typeof drizzle<typeof schema>>;
    schema: typeof schema;
    /** Persist in-memory sql.js state to disk without closing the connection. */
    flush(): void;
    close(): void;
}
export declare function createObservabilityDatabase(filename?: string): ObservabilityDatabase;
