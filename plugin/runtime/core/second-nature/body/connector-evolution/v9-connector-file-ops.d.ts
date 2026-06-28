/**
 * v9 Connector file operations — file lock, atomic write, file rollback (T6.3.2).
 *
 * Core logic:
 * - `acquireFileLock`: simple lockfile-based lock with timeout (§1 CONNECTOR_ASSET_FILE_LOCK_TIMEOUT_MS).
 * - `releaseFileLock`: remove lockfile.
 * - `atomicWriteFile`: write to temp file + rename (§1 CONNECTOR_ASSET_ATOMIC_RENAME).
 * - `rollbackConnectorFiles`: swap manifest/recipe/adapter files from previous version.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/body-connector-system.detail.md §1 §3.9 §5`
 * - ADR-004: Workspace-only autonomous connector evolution
 *
 * Dependencies:
 * - Node.js `node:fs/promises`, `node:path`
 *
 * Boundary:
 * - Filesystem operations only; no DB access, no network.
 * - All paths are resolved relative to workspaceRoot.
 * - Lock is advisory (lockfile-based), not mandatory.
 *
 * Test coverage: `tests/integration/connectors/v9-manifest-migration.test.ts`
 */
export declare const CONNECTOR_ASSET_FILE_LOCK_TIMEOUT_MS = 5000;
export declare const CONNECTOR_ASSET_ATOMIC_RENAME = true;
/**
 * Acquire an advisory file lock by creating a `.lock` sibling file.
 * Retries every 50ms until timeout. Returns a release function.
 * Throws if the lock cannot be acquired within the timeout.
 */
export declare function acquireFileLock(filePath: string, timeoutMs?: number): Promise<() => Promise<void>>;
/**
 * Write content to a file atomically using temp file + rename.
 * Ensures the target file is either fully written or unchanged.
 */
export declare function atomicWriteFile(filePath: string, content: string): Promise<void>;
/**
 * Read and parse a JSON file. Returns undefined if the file doesn't exist
 * or contains invalid JSON.
 */
export declare function safeReadJson<T>(filePath: string): Promise<T | undefined>;
/**
 * Read and parse a YAML file. Returns undefined if the file doesn't exist.
 * Uses a simple YAML parser for manifest files (key: value pairs, lists).
 */
export declare function safeReadYaml<T>(filePath: string): Promise<T | undefined>;
export interface ConnectorAssetPaths {
    manifestPath?: string;
    recipePath?: string;
    adapterPath?: string;
}
/**
 * Resolve asset paths relative to workspaceRoot.
 */
export declare function resolveAssetPaths(assets: ConnectorAssetPaths, workspaceRoot: string): ConnectorAssetPaths;
/**
 * Roll back connector asset files by copying previous version's files
 * over the current version's files. Uses atomic write + file lock.
 *
 * If a previous asset path is missing, the corresponding current file
 * is left unchanged (graceful degradation).
 */
export declare function rollbackConnectorFiles(currentAssets: ConnectorAssetPaths, previousAssets: ConnectorAssetPaths, workspaceRoot: string): Promise<{
    rolledBack: string[];
    skipped: string[];
}>;
