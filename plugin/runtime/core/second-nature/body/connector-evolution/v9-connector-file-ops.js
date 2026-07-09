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
import { promises as fs } from "node:fs";
import { join, dirname, basename, resolve as resolvePath, relative } from "node:path";
export const CONNECTOR_ASSET_FILE_LOCK_TIMEOUT_MS = 5_000;
export const CONNECTOR_ASSET_ATOMIC_RENAME = true;
// ───────────────────────────────────────────────────────────────
// File lock
// ───────────────────────────────────────────────────────────────
/**
 * Acquire an advisory file lock by creating a `.lock` sibling file.
 * Retries every 50ms until timeout. Returns a release function.
 * Throws if the lock cannot be acquired within the timeout.
 */
export async function acquireFileLock(filePath, timeoutMs = CONNECTOR_ASSET_FILE_LOCK_TIMEOUT_MS) {
    const lockPath = filePath + ".lock";
    const deadline = Date.now() + timeoutMs;
    const tempId = `${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    for (;;) {
        try {
            await fs.writeFile(lockPath, tempId, { flag: "wx" });
            return async () => {
                try {
                    const content = await fs.readFile(lockPath, "utf-8");
                    if (content.trim() === tempId) {
                        await fs.unlink(lockPath);
                    }
                }
                catch {
                    // Lock file already removed or not owned — ignore.
                }
            };
        }
        catch (err) {
            if (err.code !== "EEXIST")
                throw err;
            if (Date.now() >= deadline) {
                throw new Error(`file_lock_timeout: ${lockPath}`);
            }
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
    }
}
// ───────────────────────────────────────────────────────────────
// Atomic write
// ───────────────────────────────────────────────────────────────
/**
 * Write content to a file atomically using temp file + rename.
 * Ensures the target file is either fully written or unchanged.
 */
export async function atomicWriteFile(filePath, content) {
    const dir = dirname(filePath);
    const base = basename(filePath);
    const tempPath = join(dir, `.${base}.tmp_${process.pid}_${Date.now()}`);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(tempPath, content, "utf-8");
    try {
        await fs.rename(tempPath, filePath);
    }
    catch (err) {
        try {
            await fs.unlink(tempPath);
        }
        catch { /* ignore */ }
        throw err;
    }
}
// ───────────────────────────────────────────────────────────────
// Safe read JSON
// ───────────────────────────────────────────────────────────────
/**
 * Read and parse a JSON file. Returns undefined if the file doesn't exist
 * or contains invalid JSON.
 */
export async function safeReadJson(filePath) {
    try {
        const content = await fs.readFile(filePath, "utf-8");
        return JSON.parse(content);
    }
    catch {
        return undefined;
    }
}
/**
 * Read and parse a YAML file. Returns undefined if the file doesn't exist.
 * Uses a simple YAML parser for manifest files (key: value pairs, lists).
 */
export async function safeReadYaml(filePath) {
    try {
        const content = await fs.readFile(filePath, "utf-8");
        // Simple YAML parsing for manifest structure.
        // For production, use a proper YAML parser; this handles basic manifests.
        return parseSimpleYaml(content);
    }
    catch {
        return undefined;
    }
}
function parseListItemValue(itemValue) {
    if (itemValue.includes(": ")) {
        const obj = {};
        const pair = itemValue.split(": ", 2);
        if (pair.length === 2) {
            obj[pair[0].trim()] = pair[1].trim();
            return obj;
        }
    }
    return itemValue;
}
function parseSimpleYaml(content) {
    // Minimal YAML parser for connector manifests.
    // Handles: key: value, nested objects via indentation, list items via "- ".
    const lines = content.split("\n");
    const result = {};
    const stack = [
        { indent: 0, obj: result },
    ];
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#"))
            continue;
        const indent = line.length - line.trimStart().length;
        while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
            stack.pop();
        }
        const current = stack[stack.length - 1].obj;
        if (trimmed.startsWith("- ")) {
            // List item — convert the last key's value to an array if needed.
            // If the item contains a `key: value` form, parse it as a small object.
            const itemValue = trimmed.slice(2).trim();
            const listItem = parseListItemValue(itemValue);
            const lastKey = Object.keys(current).pop();
            if (lastKey) {
                if (Array.isArray(current[lastKey])) {
                    current[lastKey].push(listItem);
                }
                else if (current[lastKey] && typeof current[lastKey] === "object" && Object.keys(current[lastKey]).length === 0) {
                    // Was created as nested object but is actually a list
                    current[lastKey] = [listItem];
                }
                else if (current[lastKey] === undefined) {
                    current[lastKey] = [listItem];
                }
            }
        }
        else {
            const colonIdx = trimmed.indexOf(":");
            if (colonIdx > 0) {
                const key = trimmed.slice(0, colonIdx).trim();
                const value = trimmed.slice(colonIdx + 1).trim();
                if (value === "") {
                    // Nested object or list — create as empty object, will be converted
                    // to array if list items follow at deeper indentation.
                    const nested = {};
                    current[key] = nested;
                    stack.push({ indent: indent + 2, obj: nested });
                }
                else {
                    current[key] = value;
                }
            }
        }
    }
    return result;
}
function resolveWorkspacePath(workspaceRoot, relativePath) {
    if (!relativePath)
        return undefined;
    const resolved = resolvePath(workspaceRoot, relativePath);
    const rel = relative(workspaceRoot, resolved);
    if (rel.startsWith("..") || rel === "") {
        return undefined;
    }
    return resolved;
}
/**
 * Resolve asset paths relative to workspaceRoot.
 * Paths that escape workspaceRoot (including absolute paths and traversal)
 * are filtered to undefined.
 */
export function resolveAssetPaths(assets, workspaceRoot) {
    return {
        manifestPath: resolveWorkspacePath(workspaceRoot, assets.manifestPath),
        recipePath: resolveWorkspacePath(workspaceRoot, assets.recipePath),
        adapterPath: resolveWorkspacePath(workspaceRoot, assets.adapterPath),
    };
}
/**
 * Roll back connector asset files by copying previous version's files
 * over the current version's files. Uses atomic write + file lock.
 *
 * If a previous asset path is missing, the corresponding current file
 * is left unchanged (graceful degradation).
 */
export async function rollbackConnectorFiles(currentAssets, previousAssets, workspaceRoot) {
    const resolved = resolveAssetPaths(currentAssets, workspaceRoot);
    const prevResolved = resolveAssetPaths(previousAssets, workspaceRoot);
    const rolledBack = [];
    const skipped = [];
    const assetPairs = [
        [resolved.manifestPath, prevResolved.manifestPath],
        [resolved.recipePath, prevResolved.recipePath],
        [resolved.adapterPath, prevResolved.adapterPath],
    ];
    for (const [currentPath, previousPath] of assetPairs) {
        if (!currentPath || !previousPath) {
            if (currentPath)
                skipped.push(currentPath);
            continue;
        }
        try {
            const content = await fs.readFile(previousPath, "utf-8");
            const release = await acquireFileLock(currentPath);
            try {
                await atomicWriteFile(currentPath, content);
                rolledBack.push(currentPath);
            }
            finally {
                await release();
            }
        }
        catch {
            skipped.push(currentPath);
        }
    }
    return { rolledBack, skipped };
}
