/**
 * Optional better-sqlite3 load probe (T4.1.4). Second Nature state DB currently uses sql.js only;
 * this probe records whether the native module can load for packaging / host diagnostics.
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
export function probeNativeSqliteLoad() {
    try {
        const Database = require("better-sqlite3");
        const db = new Database(":memory:");
        db.close();
        let version;
        try {
            const pkg = require("better-sqlite3/package.json");
            version = pkg.version;
        }
        catch {
            version = undefined;
        }
        return { moduleLoadOk: true, version };
    }
    catch (error) {
        return {
            moduleLoadOk: false,
            errorMessage: error instanceof Error ? error.message : String(error),
        };
    }
}
