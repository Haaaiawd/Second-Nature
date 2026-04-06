import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import * as schema from "./schema/index.js";
function resolveDbPath(filename) {
    // If absolute path or in-memory, use as-is (for tests)
    if (path.isAbsolute(filename) || filename === ":memory:") {
        return filename;
    }
    // Resolve relative to the plugin installation directory, not CWD.
    // At runtime: runtime/storage/db/index.js → plugin root is 3 levels up.
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const pluginRoot = path.resolve(__dirname, "..", "..", "..");
    const dataDir = path.join(pluginRoot, "data");
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    return path.join(dataDir, filename);
}
export function createStateDatabase(filename = "state.db") {
    const dbPath = resolveDbPath(filename);
    const sqlite = new Database(dbPath);
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
