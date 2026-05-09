/**
 * Optional better-sqlite3 load probe (T4.1.4). Second Nature state DB currently uses sql.js only;
 * this probe records whether the native module can load for packaging / host diagnostics.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export interface NativeSqliteProbeResult {
  moduleLoadOk: boolean;
  /** package version when load succeeds */
  version?: string;
  errorMessage?: string;
}

export function probeNativeSqliteLoad(): NativeSqliteProbeResult {
  try {
    type BetterSqliteCtor = new (path: string) => { close(): void };
    const Database = require("better-sqlite3") as BetterSqliteCtor;
    const db = new Database(":memory:");
    db.close();
    let version: string | undefined;
    try {
      const pkg = require("better-sqlite3/package.json") as { version?: string };
      version = pkg.version;
    } catch {
      version = undefined;
    }
    return { moduleLoadOk: true, version };
  } catch (error) {
    return {
      moduleLoadOk: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}
