/**
 * SQLite schema migration runner (DR-018).
 *
 * Core logic:
 * - Maintains a `_meta` table with `schema_version` for version tracking.
 * - Executes pending migrations in ascending order within transactions.
 * - On failure, marks `schema_migration_failed` in `_meta` without crashing;
 *   existing data is preserved (transaction rollback).
 * - New columns use DEFAULT NULL to preserve backward compatibility.
 *
 * Dependencies: sql.js Database (from `sql.js` package).
 * Boundary: Called once during DB initialization; does not own the DB lifecycle.
 * Test coverage: tests/unit/storage/migration-runner.test.ts,
 *                tests/integration/storage/schema-migration.test.ts
 */
const META_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS _meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;
function ensureMetaTable(sqlite) {
    sqlite.exec(META_TABLE_SQL);
    const rows = sqlite.exec("SELECT value FROM _meta WHERE key = 'schema_version'");
    if (rows.length === 0 || rows[0].values.length === 0) {
        sqlite.exec("INSERT OR IGNORE INTO _meta (key, value) VALUES ('schema_version', '0')");
    }
}
function getSchemaVersion(sqlite) {
    const rows = sqlite.exec("SELECT value FROM _meta WHERE key = 'schema_version'");
    if (rows.length === 0 || rows[0].values.length === 0) {
        return 0;
    }
    return parseInt(rows[0].values[0][0], 10);
}
function setSchemaVersion(sqlite, version) {
    sqlite.exec(`UPDATE _meta SET value = '${version}' WHERE key = 'schema_version'`);
}
function markMigrationFailed(sqlite, version, error) {
    sqlite.exec("INSERT OR REPLACE INTO _meta (key, value) VALUES ('schema_migration_failed', '1')");
    const safeError = error.replace(/'/g, "''");
    sqlite.exec(`INSERT OR REPLACE INTO _meta (key, value) VALUES ('schema_migration_failed_version', '${version}')`);
    sqlite.exec(`INSERT OR REPLACE INTO _meta (key, value) VALUES ('schema_migration_failed_error', '${safeError}')`);
}
export function isMigrationFailed(sqlite) {
    const rows = sqlite.exec("SELECT value FROM _meta WHERE key = 'schema_migration_failed'");
    return (rows.length > 0 &&
        rows[0].values.length > 0 &&
        rows[0].values[0][0] === "1");
}
export function runMigrations(sqlite, migrations) {
    ensureMetaTable(sqlite);
    const currentVersion = getSchemaVersion(sqlite);
    const pending = migrations
        .filter((m) => m.version > currentVersion)
        .sort((a, b) => a.version - b.version);
    const applied = [];
    let failed = false;
    let failedVersion;
    let failedError;
    for (const migration of pending) {
        try {
            sqlite.exec("BEGIN EXCLUSIVE");
            sqlite.exec(migration.sql);
            setSchemaVersion(sqlite, migration.version);
            sqlite.exec("COMMIT");
            applied.push(migration.version);
        }
        catch (err) {
            try {
                sqlite.exec("ROLLBACK");
            }
            catch {
                // rollback may fail if no transaction active
            }
            const message = err instanceof Error ? err.message : String(err);
            process.stderr.write(`schema_migration_failed: v${migration.version} (${migration.label}) — ${message}\n`);
            markMigrationFailed(sqlite, migration.version, message);
            failed = true;
            failedVersion = migration.version;
            failedError = message;
            break;
        }
    }
    const finalVersion = getSchemaVersion(sqlite);
    return {
        schemaVersion: finalVersion,
        applied,
        failed,
        failedVersion,
        failedError,
    };
}
