import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema/index.js";
export function createObservabilityDatabase(filename = "./data/observability.db") {
    const sqlite = new Database(filename);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("busy_timeout = 5000");
    const db = drizzle(sqlite, { schema });
    return {
        sqlite,
        db,
        schema,
        close() {
            sqlite.close();
        },
    };
}
