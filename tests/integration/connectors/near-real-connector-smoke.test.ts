import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runNearRealConnectorSmoke } from "../../../src/connectors/near-real/near-real-connector-smoke.js";
import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createObservabilityDatabase } from "../../../src/observability/db/index.js";
import { lifeEvidenceIndex } from "../../../src/storage/db/schema/life-evidence-index.js";
import { executionAttempts } from "../../../src/observability/db/schema/index.js";
import { eq } from "drizzle-orm";

test("T3.3.1 near-real smoke — feed.read + work.discover evidence + connector execution attempts + task.claim dry sentinel", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "sn-near-real-"));
  const state = createStateDatabase(":memory:");
  const obs = createObservabilityDatabase(":memory:");

  const report = await runNearRealConnectorSmoke({
    state,
    observabilityDb: obs,
    workspaceRoot: ws,
  });

  assert.ok(report.feedReadEvidenceId);
  assert.ok(report.workDiscoverEvidenceId);
  assert.equal(report.taskClaimDryRunOk, true);
  assert.ok(report.executionAttemptRowsForDecision >= 3);

  const evidenceRows = await state.db.select().from(lifeEvidenceIndex);
  const byPlatform = Object.fromEntries(
    evidenceRows.filter((r) => r.platformId).map((r) => [r.platformId as string, r]),
  );
  assert.equal(byPlatform.moltbook?.evidenceType, "platform_browse");
  assert.equal(byPlatform.evomap?.evidenceType, "task_discovery");

  const attempts = await obs.db.select().from(executionAttempts).where(eq(executionAttempts.decisionId, "dec-near-real-smoke"));
  const caps = new Set(attempts.map((a) => a.capability));
  assert.ok(caps.has("feed.read"));
  assert.ok(caps.has("work.discover"));
  assert.ok(caps.has("task.claim"));
  assert.ok(attempts.some((a) => a.capability === "task.claim" && a.idempotencyKey === "idem-near-real-task-claim-smoke"));

  state.close();
  obs.close();
  fs.rmSync(ws, { recursive: true, force: true });
});
