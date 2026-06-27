/**
 * v9 ActionClosureRecorder — Unit Tests
 *
 * Validates:
 * - v9 SourceRef shape round-trip
 * - routineInvocationId / routineVersion linkage
 * - activityThreadId / activityStepId linkage
 * - exactly-one terminal closure per cycle
 * - idempotent retry
 * - missing source refs blocked
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import {
  actionClosureRecord,
} from "../../../src/storage/db/schema/v8-entities.js";
import { eq } from "drizzle-orm";
import {
  recordV9ActionClosure,
  recordV9NoActionClosure,
  readV9ActionClosuresByCycle,
  type V9ClosureRecordRequest,
} from "../../../src/core/second-nature/action/v9-action-closure-recorder.js";
import type { SourceRef, V9ReasonCode } from "../../../src/shared/types/v9-contracts.js";

function makeSourceRef(id: string, family: SourceRef["family"] = "evidence"): SourceRef {
  return { family, id };
}

function makeClosureRequest(
  cycleId: string,
  cycleSequence: number,
  overrides: Partial<V9ClosureRecordRequest> = {},
): V9ClosureRecordRequest {
  return {
    cycleId,
    cycleSequence,
    closureId: `cls_${cycleId}`,
    actionKind: "connector",
    decision: "allow",
    reasonCode: "policy_allowed",
    sourceRefs: [makeSourceRef("ev-1")],
    platformId: "moltbook",
    capabilityId: "feed.read",
    ...overrides,
  };
}

describe("v9-action-closure-recorder", () => {
  it("writes and reads a v9 closure with routine linkage", async () => {
    const db = createStateDatabase(":memory:");
    const cycleId = "cyc-1";

    const result = await recordV9ActionClosure(
      db,
      makeClosureRequest(cycleId, 1, {
        actionKind: "routine",
        routineInvocationId: "routine-1",
        routineVersion: "1.2.3",
        activityThreadId: "thread-1",
        activityStepId: "step-1",
      }),
    );

    assert.equal((result as { id: string }).id, `cls_${cycleId}`);

    const rows = await readV9ActionClosuresByCycle(db, cycleId);
    assert.equal(rows.rows.length, 1);
    const row = rows.rows[0];
    assert.equal(row.actionKind, "routine");
    assert.equal(row.routineInvocationId, "routine-1");
    assert.equal(row.routineVersion, "1.2.3");
    assert.equal(row.activityThreadId, "thread-1");
    assert.equal(row.activityStepId, "step-1");
    assert.equal(row.sourceRefs.length, 1);
    assert.equal(row.sourceRefs[0].family, "evidence");
  });

  it("enforces exactly-one closure per cycle", async () => {
    const db = createStateDatabase(":memory:");
    const cycleId = "cyc-2";

    const first = await recordV9ActionClosure(db, makeClosureRequest(cycleId, 1));
    assert.equal((first as { id: string }).id, `cls_${cycleId}`);

    const second = await recordV9ActionClosure(
      db,
      makeClosureRequest(cycleId, 1, { closureId: "cls_second" }),
    );
    assert.equal((second as { id: string; idempotent?: boolean }).id, `cls_${cycleId}`);
    assert.equal((second as { id: string; idempotent?: boolean }).idempotent, true);

    const rows = await readV9ActionClosuresByCycle(db, cycleId);
    assert.equal(rows.rows.length, 1);
  });

  it("records no-action closure with deterministic id", async () => {
    const db = createStateDatabase(":memory:");
    const cycleId = "cyc-3";

    const result = await recordV9NoActionClosure(
      db,
      cycleId,
      1,
      "attention_blocked_missing_sources",
      { traceRefs: [makeSourceRef("att-1", "attention")] },
    );

    assert.equal((result as { id: string }).id, `cls_v9_no_${cycleId}`);

    const rows = await readV9ActionClosuresByCycle(db, cycleId);
    assert.equal(rows.rows.length, 1);
    assert.equal(rows.rows[0].actionKind, "no_action");
    assert.equal(rows.rows[0].reasonCode, "attention_blocked_missing_sources");
  });

  it("blocks closure write when source refs are missing", async () => {
    const db = createStateDatabase(":memory:");
    const result = await recordV9ActionClosure(
      db,
      makeClosureRequest("cyc-4", 1, { sourceRefs: [] }),
    );

    assert.equal("status" in result, true);
    assert.equal((result as { reason: string }).reason, "ledger_missing_source_refs");
  });

  it("persists activity thread / step / routine ids", async () => {
    const db = createStateDatabase(":memory:");
    const cycleId = "cyc-5";

    await recordV9ActionClosure(
      db,
      makeClosureRequest(cycleId, 1, {
        activityThreadId: "thread-5",
        activityStepId: "step-5",
        routineInvocationId: "routine-5",
        routineVersion: "2.0.0",
      }),
    );

    const raw = await db.db
      .select()
      .from(actionClosureRecord)
      .where(eq(actionClosureRecord.cycleId, cycleId));
    assert.equal(raw.length, 1);
    assert.equal(raw[0].activityThreadId, "thread-5");
    assert.equal(raw[0].activityStepId, "step-5");
    assert.equal(raw[0].routineId, "routine-5");
  });

  it("serializes v9 source refs without v8 shape pollution", async () => {
    const db = createStateDatabase(":memory:");
    const cycleId = "cyc-6";
    const sourceRefs: SourceRef[] = [
      { family: "attention", id: "att-6" },
      { family: "routine", id: "routine-6" },
    ];

    await recordV9ActionClosure(db, makeClosureRequest(cycleId, 1, { sourceRefs }));

    const raw = await db.db
      .select()
      .from(actionClosureRecord)
      .where(eq(actionClosureRecord.cycleId, cycleId));
    const parsed = JSON.parse(raw[0].sourceRefsJson);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].family, "attention");
    assert.equal(parsed[0].uri, undefined);
    assert.equal(parsed[0].redactionClass, undefined);
  });
});
