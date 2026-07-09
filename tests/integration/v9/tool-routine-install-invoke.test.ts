/**
 * v9 ToolRoutine install → invoke → trace integration test (T6.2.2).
 *
 * Verifies the full routine spine against a real in-memory SQLite state DB:
 * - Valid read-only routine installs as active with ledger ref linked back.
 * - Invalid (permission-expanding) routine is denied before persistence.
 * - Active routine invocation writes RoutineExecutionTrace row.
 * - Denied invocation (policy gate) writes denied trace row.
 * - Retire transitions routine and writes retire ledger entry.
 * - Trace rows are queryable by routine id.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import {
  readToolRoutineById,
  readRoutineExecutionTracesByRoutine,
  readAutonomousChangeLedgerByTarget,
} from "../../../src/storage/v9-state-stores.js";
import {
  installToolRoutine,
  invokeToolRoutine,
  retireToolRoutine,
  loadActiveRoutine,
  listActiveRoutinesByCapabilityPattern,
  createStateStoreRegistryPorts,
  createStateStoreLedgerPort,
} from "../../../src/core/second-nature/body/tool-routine/v9-tool-routine-registry.js";
import type {
  RoutineCandidate,
  RoutineInvocationContext,
  ToolRoutineGuardSchema,
} from "../../../src/shared/types/v9-contracts.js";

const NOW = "2026-06-28T10:00:00Z";

function makeGuard(overrides: Partial<ToolRoutineGuardSchema> = {}): ToolRoutineGuardSchema {
  return {
    version: "1.0.0",
    allowedCapabilities: ["moltbook:feed.read"],
    deniedCapabilities: [],
    maxSideEffectClass: "none",
    requiresOwnerConfirm: false,
    maxStepCount: 5,
    maxTimeoutMs: 5000,
    sandboxPolicy: "declarative_only",
    ...overrides,
  };
}

function makeCandidate(overrides: Partial<RoutineCandidate> = {}): RoutineCandidate {
  return {
    routineId: "rtn-int-1",
    name: "feed-reader-routine",
    version: "1.0.0",
    capabilityPattern: "moltbook:feed.read",
    triggerCapabilities: ["moltbook:feed.read"],
    triggerConditionsJson: JSON.stringify({ minSuccessCount: 3 }),
    stepsJson: JSON.stringify([
      { stepId: "s1", kind: "declarative", capabilityId: "moltbook:feed.read", summary: "read feed", timeoutMs: 1000 },
      { stepId: "s2", kind: "declarative", capabilityId: "moltbook:feed.read", summary: "filter entries", timeoutMs: 500 },
    ]),
    guardSchemaJson: JSON.stringify(makeGuard()),
    rollbackRef: "rollback://rtn-int-1",
    sourceRefs: [{ family: "routine", id: "rtn-int-1" }],
    workspaceRoot: "/workspace",
    ...overrides,
  };
}

function makeInvocationCtx(overrides: Partial<RoutineInvocationContext> = {}): RoutineInvocationContext {
  return {
    cycleId: "cyc-int-1",
    payload: { limit: 10 },
    sourceRefs: [{ family: "attention", id: "att-int-1" }],
    policyAllowed: true,
    now: NOW,
    ...overrides,
  };
}

describe("INT-T6.2.2 tool-routine install + invoke", () => {
  it("installs valid read-only routine as active with ledger ref and invokes it", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const ports = createStateStoreRegistryPorts(db);
      const ledger = createStateStoreLedgerPort(db);
      const deps = {
        ports,
        ledger,
        generateId: () => `id_${Math.random().toString(36).slice(2, 10)}`,
        now: () => NOW,
      };

      // 1. Install
      const installResult = await installToolRoutine(makeCandidate(), { allowed: true }, deps);
      assert.equal(installResult.status, "active");
      assert.ok(installResult.routine);
      assert.ok(installResult.ledgerRef);

      // 2. Verify routine persisted in DB with ledger ref linked back
      const row = await readToolRoutineById(db, "rtn-int-1");
      assert.ok(row);
      assert.equal(row!.status, "active");
      assert.equal(row!.ledgerRef, installResult.ledgerRef);
      assert.equal(row!.activatedAt, NOW);

      // 3. Verify ledger entry persisted
      const ledgerRows = await readAutonomousChangeLedgerByTarget(db, "rtn-int-1");
      assert.equal(ledgerRows.rows.length, 1);
      assert.equal(ledgerRows.rows[0].changeKind, "routine_install");
      assert.equal(ledgerRows.rows[0].status, "activated");

      // 4. Invoke
      const invokeResult = await invokeToolRoutine("rtn-int-1", makeInvocationCtx(), deps);
      assert.equal(invokeResult.status, "executed");
      assert.ok(invokeResult.trace);
      assert.equal(invokeResult.trace!.length, 2);
      assert.equal(invokeResult.trace![0].outcome, "success");
      assert.ok(invokeResult.traceId);

      // 5. Verify trace persisted in DB
      const traces = await readRoutineExecutionTracesByRoutine(db, "rtn-int-1");
      assert.equal(traces.rows.length, 1);
      assert.equal(traces.rows[0].status, "executed");
      assert.equal(traces.rows[0].cycleId, "cyc-int-1");
    } finally {
      db.close();
    }
  });

  it("denies permission-expanding routine before persistence", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const ports = createStateStoreRegistryPorts(db);
      const ledger = createStateStoreLedgerPort(db);
      const deps = {
        ports,
        ledger,
        generateId: () => `id_${Math.random().toString(36).slice(2, 10)}`,
        now: () => NOW,
      };

      // Guard allows post.publish but trigger only has feed.read → expansion
      const guard = makeGuard({ allowedCapabilities: ["moltbook:feed.read", "moltbook:post.publish"] });
      const result = await installToolRoutine(
        makeCandidate({ guardSchemaJson: JSON.stringify(guard) }),
        { allowed: true },
        deps,
      );

      assert.equal(result.status, "denied");
      assert.equal(result.reason, "routine_permission_expansion_denied");

      // Nothing persisted
      const row = await readToolRoutineById(db, "rtn-int-1");
      assert.equal(row, undefined);
    } finally {
      db.close();
    }
  });

  it("denies invocation when policy gate rejects and writes denied trace", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const ports = createStateStoreRegistryPorts(db);
      const ledger = createStateStoreLedgerPort(db);
      const deps = {
        ports,
        ledger,
        generateId: () => `id_${Math.random().toString(36).slice(2, 10)}`,
        now: () => NOW,
      };

      await installToolRoutine(makeCandidate(), { allowed: true }, deps);

      const result = await invokeToolRoutine(
        "rtn-int-1",
        makeInvocationCtx({ policyAllowed: false, policyReason: "routine_guard_policy_denied" }),
        deps,
      );

      assert.equal(result.status, "denied");
      assert.equal(result.reason, "routine_guard_policy_denied");

      const traces = await readRoutineExecutionTracesByRoutine(db, "rtn-int-1");
      assert.equal(traces.rows.length, 1);
      assert.equal(traces.rows[0].status, "denied");
    } finally {
      db.close();
    }
  });

  it("retires active routine and blocks subsequent invocation", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const ports = createStateStoreRegistryPorts(db);
      const ledger = createStateStoreLedgerPort(db);
      const deps = {
        ports,
        ledger,
        generateId: () => `id_${Math.random().toString(36).slice(2, 10)}`,
        now: () => NOW,
      };

      await installToolRoutine(makeCandidate(), { allowed: true }, deps);

      const retireResult = await retireToolRoutine("rtn-int-1", { ...deps, workspaceRoot: "/workspace" });
      assert.ok(retireResult.ok);

      // DB row is retired
      const row = await readToolRoutineById(db, "rtn-int-1");
      assert.equal(row!.status, "retired");
      assert.ok(row!.retiredAt);

      // Retire ledger entry written
      const ledgerRows = await readAutonomousChangeLedgerByTarget(db, "rtn-int-1");
      assert.equal(ledgerRows.rows.length, 2);
      assert.equal(ledgerRows.rows[1].changeKind, "routine_retire");

      // Invocation denied after retire
      const invokeResult = await invokeToolRoutine("rtn-int-1", makeInvocationCtx(), deps);
      assert.equal(invokeResult.status, "denied");
      assert.equal(invokeResult.reason, "routine_invocation_denied");
    } finally {
      db.close();
    }
  });

  it("loadActiveRoutine and listActiveRoutinesByCapabilityPattern read from DB", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const ports = createStateStoreRegistryPorts(db);
      const ledger = createStateStoreLedgerPort(db);
      const deps = {
        ports,
        ledger,
        generateId: () => `id_${Math.random().toString(36).slice(2, 10)}`,
        now: () => NOW,
      };

      await installToolRoutine(makeCandidate(), { allowed: true }, deps);

      const routine = await loadActiveRoutine("rtn-int-1", deps);
      assert.ok(routine);
      assert.equal(routine!.routineId, "rtn-int-1");
      assert.equal(routine!.triggerCapabilities[0], "moltbook:feed.read");

      const list = await listActiveRoutinesByCapabilityPattern("moltbook:feed.read", deps);
      assert.equal(list.length, 1);
      assert.equal(list[0].routineId, "rtn-int-1");
    } finally {
      db.close();
    }
  });
});
