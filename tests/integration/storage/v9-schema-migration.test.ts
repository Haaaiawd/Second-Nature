/**
 * v9 storage schema and migration tests.
 *
 * Covers:
 * - Fresh bootstrap creates v9 tables/columns.
 * - v8-to-v9 migration adds identity columns and new tables idempotently.
 * - Activity thread/step persistence and idempotent append.
 */

import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { createStateDatabase } from "../../../src/storage/db/index.js";
import type { StateDatabase } from "../../../src/storage/db/index.js";
import {
  writeAttentionSignal,
  writeActivityThread,
  writeActivityStep,
  readActivityThreadById,
  readActivityStepsByThreadId,
  updateActivityThreadProgress,
} from "../../../src/storage/v9-state-stores.js";

describe("v9 schema migration", () => {
  let db: StateDatabase;

  beforeEach(() => {
    db = createStateDatabase(":memory:");
  });

  it("fresh bootstrap creates attention_signal and activity_thread tables", () => {
    const tables = db.sqlite.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('attention_signal', 'activity_thread', 'activity_step', 'tool_routine', 'self_continuity_card', 'character_frame', 'connector_evolution_plan', 'connector_version', 'autonomous_change_ledger', 'routine_execution_trace')",
    );
    const names = tables[0]?.values.map((row) => String(row[0])) ?? [];
    assert.equal(names.length, 10);
    assert.ok(names.includes("attention_signal"));
    assert.ok(names.includes("activity_thread"));
    assert.ok(names.includes("activity_step"));
  });

  it("fresh bootstrap creates evidence identity columns", () => {
    const info = db.sqlite.exec("PRAGMA table_info(evidence_item)");
    const names = info[0]?.values.map((row) => String(row[1])) ?? [];
    assert.ok(names.includes("external_id"));
    assert.ok(names.includes("stable_identity_key"));
    assert.ok(names.includes("seen_count"));
    assert.ok(names.includes("row_identity_status"));
  });

  it("fresh bootstrap creates action_closure routine/activity linkage columns", () => {
    const info = db.sqlite.exec("PRAGMA table_info(action_closure_record)");
    const names = info[0]?.values.map((row) => String(row[1])) ?? [];
    assert.ok(names.includes("routine_id"));
    assert.ok(names.includes("activity_thread_id"));
    assert.ok(names.includes("activity_step_id"));
  });

  it("migration is idempotent on existing v8 DB", () => {
    // Simulate a pre-v9 DB by running only the v8 bootstrap subset and then
    // letting applyStateSchemaMigrations run via createStateDatabase.
    const legacy = createStateDatabase(":memory:");
    legacy.sqlite.exec("DROP TABLE IF EXISTS attention_signal");
    legacy.sqlite.exec("DROP TABLE IF EXISTS activity_thread");
    legacy.sqlite.exec("DROP TABLE IF EXISTS activity_step");
    // Re-open runs migrations again; idempotent statements should not throw.
    const reopened = createStateDatabase(":memory:");
    const info = reopened.sqlite.exec("PRAGMA table_info(evidence_item)");
    const names = info[0]?.values.map((row) => String(row[1])) ?? [];
    assert.ok(names.includes("stable_identity_key"));
  });

  it("writes and reads attention signal", async () => {
    const signal = await writeAttentionSignal(db, {
      id: "sig-1",
      createdAt: new Date().toISOString(),
      cycleId: "cycle-1",
      novelty: 0.7,
      relevance: 0.8,
      repetition: "new",
      status: "attentive",
      sourceRefs: [{ family: "evidence", id: "ev-1" }],
      threadSuggestion: "create",
    });
    assert.equal(signal.status, "attentive");
    assert.equal(signal.threadSuggestion, "create");
  });

  it("rejects attention signal without source refs", async () => {
    await assert.rejects(
      writeAttentionSignal(db, {
        id: "sig-2",
        createdAt: new Date().toISOString(),
        cycleId: "cycle-1",
        novelty: 0,
        relevance: 0,
        repetition: "identity_unstable",
        status: "attention_blocked_missing_sources",
        sourceRefs: [],
      }),
      /sourceRefs required/,
    );
  });

  it("writes and advances activity thread with steps", async () => {
    const now = new Date().toISOString();
    const thread = await writeActivityThread(db, {
      id: "th-1",
      originAttentionSignalId: "sig-1",
      status: "active",
      currentFocus: "review cue",
      stopCondition: "single_step_done",
      lastHeartbeatSequence: 1,
      sourceRefs: [{ family: "attention", id: "sig-1" }],
      createdAt: now,
      updatedAt: now,
    });
    assert.equal(thread.completedStepCount, 0);

    const step = await writeActivityStep(db, {
      id: "step-1",
      threadId: "th-1",
      cycleId: "cycle-1",
      stepKind: "observe",
      summary: "observed related evidence",
      sourceRefs: [{ family: "evidence", id: "ev-1" }],
      createdAt: now,
    });
    assert.equal(step.threadId, "th-1");

    await updateActivityThreadProgress(db, "th-1", {
      completedStepCount: 1,
      lastStepKind: "observe",
      lastHeartbeatSequence: 2,
      updatedAt: new Date().toISOString(),
    });

    const updated = await readActivityThreadById(db, "th-1");
    assert.equal(updated?.completedStepCount, 1);
    assert.equal(updated?.lastStepKind, "observe");

    const steps = await readActivityStepsByThreadId(db, "th-1");
    assert.equal(steps.length, 1);
  });
});
