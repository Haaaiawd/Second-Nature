import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * After `pnpm build:plugin`, `plugin/runtime` mirrors compiled `src/storage` — same bundle as packaged plugin.
 * Load by absolute path from cwd (repo root during `pnpm test`).
 */
test("T4.1.4 packaged runtime artifact exposes runStorageModeSmoke", async () => {
  const abs = path.join(process.cwd(), "plugin/runtime/storage/bootstrap/storage-mode-smoke.js");
  const mod = await import(pathToFileURL(abs).href);
  assert.equal(typeof mod.runStorageModeSmoke, "function");
  const report = await mod.runStorageModeSmoke({});
  assert.equal(report.runtimeIndexDriver, "sql_js");
  assert.equal(report.semantics.sqlJs.walAssumed, false);
  assert.equal(typeof report.nativeSqliteProbe.moduleLoadOk, "boolean");
});
