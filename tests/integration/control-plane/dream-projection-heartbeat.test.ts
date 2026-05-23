import test from "node:test";
import assert from "node:assert/strict";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createGoalLifecycleStore } from "../../../src/storage/services/goal-lifecycle-store.js";
import { createIdentityProfileStore } from "../../../src/storage/services/identity-profile-store.js";
import { createInteractionSnapshotProjector } from "../../../src/storage/services/interaction-snapshot-projector.js";
import { createToolExperienceStore } from "../../../src/storage/services/tool-experience-store.js";
import { createEmbodiedContextStatePort } from "../../../src/storage/services/embodied-context-state-port.js";
import { createEmbodiedContextAssembler } from "../../../src/core/second-nature/heartbeat/embodied-context-assembler.js";
import type { AffordanceAssembler } from "../../../src/core/second-nature/body/tool-affordance/affordance-assembler.js";

function buildBaseDeps() {
  const db = createStateDatabase(":memory:");
  const goalStore = createGoalLifecycleStore(db);
  const identityStore = createIdentityProfileStore(db);
  const projector = createInteractionSnapshotProjector(db);
  const experienceStore = createToolExperienceStore(db);

  const statePort = createEmbodiedContextStatePort({
    database: db,
    goalStore,
    identityStore,
    interactionProjector: projector,
    experienceStore,
  });

  return { db, statePort };
}

function createMinimalAffordanceAssembler(): AffordanceAssembler {
  return {
    async assembleAffordanceMap() {
      return {};
    },
    invalidateCache() {
      /* no-op */
    },
  };
}

function setupDreamOutputTable(db: ReturnType<typeof createStateDatabase>) {
  db.sqlite.exec(`
    CREATE TABLE IF NOT EXISTS dream_output_index (
      output_id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'candidate',
      canonical_entries_json TEXT NOT NULL DEFAULT '[]',
      insights_json TEXT NOT NULL DEFAULT '[]',
      narrative_update_json TEXT,
      relationship_update_json TEXT,
      validation_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function insertDreamOutput(
  db: ReturnType<typeof createStateDatabase>,
  outputId: string,
  runId: string,
  status: string,
) {
  db.sqlite.exec(
    `INSERT INTO dream_output_index
     (output_id, run_id, status, canonical_entries_json, insights_json, validation_json, created_at)
     VALUES ('${outputId}', '${runId}', '${status}', '[]', '[]', '{}', datetime('now'))`,
  );
}

test("T-DQS.C.5 accepted projection is loaded by EmbodiedContextAssembler", async () => {
  const { db, statePort } = buildBaseDeps();
  setupDreamOutputTable(db);
  insertDreamOutput(db, "out-accepted-1", "run-1", "accepted");
  insertDreamOutput(db, "out-candidate-1", "run-2", "candidate");
  insertDreamOutput(db, "out-archived-1", "run-3", "archived");

  const assembler = createEmbodiedContextAssembler({
    statePort,
    affordanceAssembler: createMinimalAffordanceAssembler(),
  });

  const context = await assembler.assembleEmbodiedContext();

  assert.equal(context.acceptedDream.status, "loaded");
  assert.equal(context.acceptedDream.data.length, 1);
  assert.equal(context.acceptedDream.data[0]!.outputId, "out-accepted-1");
});

test("T-DQS.C.5 candidate projection is excluded from heartbeat context", async () => {
  const { db, statePort } = buildBaseDeps();
  setupDreamOutputTable(db);
  insertDreamOutput(db, "out-candidate-1", "run-1", "candidate");

  const assembler = createEmbodiedContextAssembler({
    statePort,
    affordanceAssembler: createMinimalAffordanceAssembler(),
  });

  const context = await assembler.assembleEmbodiedContext();

  assert.equal(context.acceptedDream.status, "degraded");
  assert.equal(context.acceptedDream.data.length, 0);
  assert.equal(context.acceptedDream.reason, "context_degraded:dream_projection_unavailable");
});

test("T-DQS.C.5 empty accepted projection returns degraded reason code", async () => {
  const { db, statePort } = buildBaseDeps();
  setupDreamOutputTable(db);

  const assembler = createEmbodiedContextAssembler({
    statePort,
    affordanceAssembler: createMinimalAffordanceAssembler(),
  });

  const context = await assembler.assembleEmbodiedContext();

  assert.equal(context.acceptedDream.status, "degraded");
  assert.equal(context.acceptedDream.data.length, 0);
  assert.equal(context.acceptedDream.reason, "context_degraded:dream_projection_unavailable");
});

test("T-DQS.C.5 loadAcceptedDreamProjection filters by accepted status only", async () => {
  const { db, statePort } = buildBaseDeps();
  setupDreamOutputTable(db);
  insertDreamOutput(db, "out-accepted-1", "run-1", "accepted");
  insertDreamOutput(db, "out-accepted-2", "run-2", "accepted");
  insertDreamOutput(db, "out-candidate-1", "run-3", "candidate");
  insertDreamOutput(db, "out-archived-1", "run-4", "archived");

  const result = await statePort.loadAcceptedDreamProjection(10);

  assert.equal(result.status, "loaded");
  assert.equal(result.data.length, 2);
  const ids = result.data.map((d) => d.outputId).sort();
  assert.deepEqual(ids, ["out-accepted-1", "out-accepted-2"]);
});
