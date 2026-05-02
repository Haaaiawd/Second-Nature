import test from "node:test";
import assert from "node:assert/strict";

import { runStorageModeSmoke } from "../../../src/storage/bootstrap/storage-mode-smoke.js";

test("T4.1.4 runStorageModeSmoke — sql.js runtime, no WAL assumption, native probe present", async () => {
  const report = await runStorageModeSmoke({});
  assert.equal(report.runtimeIndexDriver, "sql_js");
  assert.equal(report.semantics.sqlJs.walAssumed, false);
  assert.match(report.semantics.sqlJs.journalConcurrencyNotes, /sql\.js|WASM/i);
  assert.match(report.semantics.sqlJs.backupNotes, /export|manifest/i);
  assert.equal(report.nativeSqliteProbe.runtimeUsesNativeDriver, false);
  assert.equal(typeof report.nativeSqliteProbe.moduleLoadOk, "boolean");
});

test("T4.1.4 repair fixture replays evidence artifact into index (sql.js path)", async () => {
  const report = await runStorageModeSmoke({ runRepairFixture: true });
  assert.ok(report.repairFromArtifactsFixture?.ran);
  assert.equal(report.repairFromArtifactsFixture?.repairStatus, "ok");
  assert.ok((report.repairFromArtifactsFixture?.repairedEvidenceIndexRows ?? 0) >= 1);
});
