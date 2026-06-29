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
import type { Database } from "sql.js";
export interface Migration {
    version: number;
    label: string;
    sql: string;
}
export interface MigrationResult {
    schemaVersion: number;
    applied: number[];
    failed: boolean;
    failedVersion?: number;
    failedError?: string;
}
export declare function getSchemaVersion(sqlite: Database): number;
export declare function setSchemaVersion(sqlite: Database, version: number): void;
export declare function isMigrationFailed(sqlite: Database): boolean;
export declare function runMigrations(sqlite: Database, migrations: readonly Migration[]): MigrationResult;
