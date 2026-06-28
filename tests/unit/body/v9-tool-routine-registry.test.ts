/**
 * v9 ToolRoutine Registry — Unit Tests (T6.2.2)
 *
 * Validates:
 * - guard syntax validation (valid + invalid)
 * - sandbox policy compliance (declarative_only rejects scriptable; step count / timeout ceilings)
 * - permission expansion denied (allowedCapabilities exceed trigger provenance)
 * - active invocation succeeds and writes trace
 * - denied invocation (policy gate / not found / retired) writes denied trace
 * - retire transitions active → retired
 *
 * Uses in-memory mock ports; no DB access.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  installToolRoutine,
  invokeToolRoutine,
  retireToolRoutine,
  loadActiveRoutine,
  listRoutinesByStatus,
  readRoutineTraces,
  type ToolRoutineRegistryPorts,
  type ToolRoutineRecordRow,
  type RoutineTraceRow,
  type LedgerWritePort,
  type ToolRoutineRegistryDeps,
} from "../../../src/core/second-nature/body/tool-routine/v9-tool-routine-registry.js";
import {
  validateGuardSchema,
  validateSandboxCompliance,
  parseRoutineSteps,
} from "../../../src/core/second-nature/body/tool-routine/v9-routine-validation.js";
import type {
  RoutineCandidate,
  RoutineInvocationContext,
  ToolRoutineGuardSchema,
  SourceRef,
} from "../../../src/shared/types/v9-contracts.js";

// ───────────────────────────────────────────────────────────────
// Fixtures
// ───────────────────────────────────────────────────────────────

const NOW = "2026-06-28T10:00:00Z";

function makeGuard(overrides: Partial<ToolRoutineGuardSchema> = {}): ToolRoutineGuardSchema {
  return {
    version: "1.0.0",
    allowedCapabilities: ["moltbook:feed.read"],
    deniedCapabilities: [],
    maxSideEffectClass: "owner_attention",
    requiresOwnerConfirm: false,
    maxStepCount: 5,
    maxTimeoutMs: 5000,
    sandboxPolicy: "declarative_only",
    ...overrides,
  };
}

function guardJson(guard: ToolRoutineGuardSchema = makeGuard()): string {
  return JSON.stringify(guard);
}

function makeCandidate(overrides: Partial<RoutineCandidate> = {}): RoutineCandidate {
  return {
    routineId: "rtn-1",
    name: "feed-reader-routine",
    version: "1.0.0",
    capabilityPattern: "moltbook:feed.read",
    triggerCapabilities: ["moltbook:feed.read"],
    triggerConditionsJson: JSON.stringify({ minSuccessCount: 3 }),
    stepsJson: JSON.stringify([
      { stepId: "s1", kind: "declarative", capabilityId: "moltbook:feed.read", summary: "read feed", timeoutMs: 1000 },
    ]),
    guardSchemaJson: guardJson(),
    rollbackRef: "rollback://rtn-1",
    sourceRefs: [{ family: "routine", id: "rtn-1" }],
    workspaceRoot: "/workspace",
    ...overrides,
  };
}

function makeInvocationCtx(overrides: Partial<RoutineInvocationContext> = {}): RoutineInvocationContext {
  return {
    cycleId: "cyc-1",
    payload: {},
    sourceRefs: [{ family: "attention", id: "att-1" }],
    policyAllowed: true,
    now: NOW,
    ...overrides,
  };
}

// ───────────────────────────────────────────────────────────────
// Mock ports
// ───────────────────────────────────────────────────────────────

function createMockPorts(): ToolRoutineRegistryPorts & {
  routines: Map<string, ToolRoutineRecordRow>;
  traces: RoutineTraceRow[];
} {
  const routines = new Map<string, ToolRoutineRecordRow>();
  const traces: RoutineTraceRow[] = [];
  return {
    routines,
    traces,
    async writeRoutine(record) {
      const row: ToolRoutineRecordRow = {
        id: record.id,
        name: record.name,
        version: record.version,
        capabilityPattern: record.capabilityPattern,
        status: record.status,
        sourceRefs: record.sourceRefs,
        rollbackRef: record.rollbackRef,
        guardRefs: record.guardRefs,
        ledgerRef: record.ledgerRef,
        redactionClass: record.redactionClass ?? "none",
        triggerCapabilities: record.triggerCapabilities,
        triggerConditionsJson: record.triggerConditionsJson,
        stepsJson: record.stepsJson,
        guardSchemaJson: record.guardSchemaJson,
        activatedAt: record.activatedAt,
        retiredAt: record.retiredAt,
        createdAt: record.createdAt,
      };
      routines.set(row.id, row);
      return row;
    },
    async readRoutineById(id) {
      return routines.get(id);
    },
    async readActiveByCapabilityPattern(capabilityPattern) {
      return [...routines.values()].filter(
        (r) => r.status === "active" && r.capabilityPattern === capabilityPattern,
      );
    },
    async readByStatus(status) {
      return [...routines.values()].filter((r) => r.status === status);
    },
    async updateRoutineStatus(id, status, patch) {
      const row = routines.get(id);
      if (!row) return undefined;
      const updated: ToolRoutineRecordRow = {
        ...row,
        status,
        activatedAt: patch?.activatedAt ?? row.activatedAt,
        retiredAt: patch?.retiredAt ?? row.retiredAt,
        ledgerRef: patch?.ledgerRef ?? row.ledgerRef,
      };
      routines.set(id, updated);
      return updated;
    },
    async writeTrace(trace) {
      const row: RoutineTraceRow = {
        id: trace.id,
        routineId: trace.routineId,
        cycleId: trace.cycleId,
        status: trace.status,
        sourceRefs: trace.sourceRefs,
        proofRefs: trace.proofRefs,
        traceRefs: trace.traceRefs,
        payloadJson: trace.payloadJson,
        createdAt: trace.createdAt,
      };
      traces.push(row);
      return row;
    },
    async readTracesByRoutine(routineId, limit = 50) {
      return traces.filter((t) => t.routineId === routineId).slice(0, limit);
    },
  };
}

function createMockLedger(): LedgerWritePort & { entries: { id: string; changeKind: string; targetId: string }[] } {
  const entries: { id: string; changeKind: string; targetId: string }[] = [];
  return {
    entries,
    async writeLedgerEntry(entry) {
      entries.push({ id: entry.id, changeKind: entry.changeKind, targetId: entry.targetId });
      return { id: entry.id };
    },
  };
}

function createMockDeps(
  ports: ToolRoutineRegistryPorts,
  ledger: LedgerWritePort,
): ToolRoutineRegistryDeps {
  return {
    ports,
    ledger,
    generateId: () => `mock_${Math.random().toString(36).slice(2, 10)}`,
    now: () => NOW,
  };
}

// ───────────────────────────────────────────────────────────────
// validateGuardSchema
// ───────────────────────────────────────────────────────────────

describe("T6.2.2 validateGuardSchema", () => {
  it("accepts valid guard with allowedCapabilities subset of trigger provenance", () => {
    const result = validateGuardSchema(guardJson(), {
      triggerCapabilities: ["moltbook:feed.read"],
      capabilityPattern: "moltbook:feed.read",
    });
    assert.ok(result.ok);
    assert.equal(result.guard.allowedCapabilities[0], "moltbook:feed.read");
  });

  it("denies permission expansion when allowedCapabilities exceed trigger provenance", () => {
    const guard = makeGuard({ allowedCapabilities: ["moltbook:feed.read", "moltbook:post.publish"] });
    const result = validateGuardSchema(guardJson(guard), {
      triggerCapabilities: ["moltbook:feed.read"],
      capabilityPattern: "moltbook:feed.read",
    });
    assert.ok(!result.ok);
    assert.equal(result.reason, "routine_permission_expansion_denied");
  });

  it("denies invalid guard schema (missing version)", () => {
    const result = validateGuardSchema(JSON.stringify({ allowedCapabilities: [] }), {
      triggerCapabilities: ["moltbook:feed.read"],
    });
    assert.ok(!result.ok);
    assert.equal(result.reason, "routine_guard_schema_invalid");
  });

  it("denies maxSideEffectClass exceeding trigger capability ceiling", () => {
    // feed.read → owner_attention ceiling; guard claims external_write → expansion denied
    const guard = makeGuard({ maxSideEffectClass: "external_write" });
    const result = validateGuardSchema(guardJson(guard), {
      triggerCapabilities: ["moltbook:feed.read"],
      capabilityPattern: "moltbook:feed.read",
    });
    assert.ok(!result.ok);
    assert.equal(result.reason, "routine_permission_expansion_denied");
  });

  it("accepts external_write guard when trigger capability supports it", () => {
    const guard = makeGuard({
      allowedCapabilities: ["moltbook:post.publish"],
      maxSideEffectClass: "external_write",
    });
    const result = validateGuardSchema(guardJson(guard), {
      triggerCapabilities: ["moltbook:post.publish"],
      capabilityPattern: "moltbook:post.publish",
    });
    assert.ok(result.ok);
  });
});

// ───────────────────────────────────────────────────────────────
// validateSandboxCompliance
// ───────────────────────────────────────────────────────────────

describe("T6.2.2 validateSandboxCompliance", () => {
  it("accepts declarative steps under declarative_only policy", () => {
    const guard = makeGuard({ sandboxPolicy: "declarative_only" });
    const stepsJson = JSON.stringify([
      { stepId: "s1", kind: "declarative", capabilityId: "moltbook:feed.read", summary: "read", timeoutMs: 1000 },
    ]);
    const result = validateSandboxCompliance(stepsJson, guard);
    assert.ok(result.ok);
  });

  it("rejects scriptable steps under declarative_only policy", () => {
    const guard = makeGuard({ sandboxPolicy: "declarative_only" });
    const stepsJson = JSON.stringify([
      { stepId: "s1", kind: "scriptable", capabilityId: "moltbook:feed.read", summary: "run script", timeoutMs: 1000 },
    ]);
    const result = validateSandboxCompliance(stepsJson, guard);
    assert.ok(!result.ok);
    assert.match(result.detail ?? "", /scriptable_step.*rejected_by_declarative_only/);
  });

  it("rejects step count exceeding maxStepCount", () => {
    const guard = makeGuard({ maxStepCount: 1 });
    const stepsJson = JSON.stringify([
      { stepId: "s1", kind: "declarative", capabilityId: "moltbook:feed.read", summary: "a", timeoutMs: 100 },
      { stepId: "s2", kind: "declarative", capabilityId: "moltbook:feed.read", summary: "b", timeoutMs: 100 },
    ]);
    const result = validateSandboxCompliance(stepsJson, guard);
    assert.ok(!result.ok);
    assert.match(result.detail ?? "", /step_count_2_exceeds_max_1/);
  });

  it("rejects step timeout exceeding maxTimeoutMs", () => {
    const guard = makeGuard({ maxTimeoutMs: 500 });
    const stepsJson = JSON.stringify([
      { stepId: "s1", kind: "declarative", capabilityId: "moltbook:feed.read", summary: "slow", timeoutMs: 1000 },
    ]);
    const result = validateSandboxCompliance(stepsJson, guard);
    assert.ok(!result.ok);
    assert.match(result.detail ?? "", /timeout.*exceeds_max/);
  });

  it("rejects step with capability not in allowedCapabilities", () => {
    const guard = makeGuard({ allowedCapabilities: ["moltbook:feed.read"] });
    const stepsJson = JSON.stringify([
      { stepId: "s1", kind: "declarative", capabilityId: "moltbook:post.publish", summary: "write", timeoutMs: 100 },
    ]);
    const result = validateSandboxCompliance(stepsJson, guard);
    assert.ok(!result.ok);
    assert.match(result.detail ?? "", /not_allowed/);
  });

  it("rejects step with capability in deniedCapabilities", () => {
    const guard = makeGuard({ deniedCapabilities: ["moltbook:feed.read"] });
    const stepsJson = JSON.stringify([
      { stepId: "s1", kind: "declarative", capabilityId: "moltbook:feed.read", summary: "read", timeoutMs: 100 },
    ]);
    const result = validateSandboxCompliance(stepsJson, guard);
    assert.ok(!result.ok);
    assert.match(result.detail ?? "", /denied/);
  });
});

// ───────────────────────────────────────────────────────────────
// parseRoutineSteps
// ───────────────────────────────────────────────────────────────

describe("T6.2.2 parseRoutineSteps", () => {
  it("parses valid steps array", () => {
    const stepsJson = JSON.stringify([
      { stepId: "s1", kind: "declarative", capabilityId: "cap:read", summary: "r", timeoutMs: 100 },
    ]);
    const result = parseRoutineSteps(stepsJson);
    assert.ok(result.ok);
    assert.equal(result.steps.length, 1);
    assert.equal(result.steps[0].stepId, "s1");
  });

  it("rejects missing steps json", () => {
    const result = parseRoutineSteps(undefined);
    assert.ok(!result.ok);
    assert.equal(result.reason, "missing_steps_json");
  });

  it("rejects invalid json", () => {
    const result = parseRoutineSteps("{not json");
    assert.ok(!result.ok);
    assert.equal(result.reason, "invalid_steps_json");
  });

  it("rejects non-array steps", () => {
    const result = parseRoutineSteps(JSON.stringify({ stepId: "s1" }));
    assert.ok(!result.ok);
    assert.equal(result.reason, "steps_not_array");
  });
});

// ───────────────────────────────────────────────────────────────
// installToolRoutine
// ───────────────────────────────────────────────────────────────

describe("T6.2.2 installToolRoutine", () => {
  it("installs valid read-only routine as active with ledger ref", async () => {
    const ports = createMockPorts();
    const ledger = createMockLedger();
    const deps = createMockDeps(ports, ledger);

    const result = await installToolRoutine(makeCandidate(), { allowed: true }, deps);

    assert.equal(result.status, "active");
    assert.ok(result.routine);
    assert.equal(result.routine!.status, "active");
    assert.ok(result.ledgerRef);
    assert.equal(ledger.entries.length, 1);
    assert.equal(ledger.entries[0].changeKind, "routine_install");

    // Routine persisted with ledger ref linked back.
    const row = ports.routines.get("rtn-1");
    assert.ok(row);
    assert.equal(row!.status, "active");
    assert.equal(row!.ledgerRef, result.ledgerRef);
  });

  it("denies routine when policy gate rejects", async () => {
    const ports = createMockPorts();
    const ledger = createMockLedger();
    const deps = createMockDeps(ports, ledger);

    const result = await installToolRoutine(
      makeCandidate(),
      { allowed: false, reason: "routine_permission_expansion_denied" },
      deps,
    );

    assert.equal(result.status, "denied");
    assert.equal(result.reason, "routine_permission_expansion_denied");
    assert.equal(ports.routines.size, 0);
    assert.equal(ledger.entries.length, 0);
  });

  it("denies routine with invalid guard schema", async () => {
    const ports = createMockPorts();
    const ledger = createMockLedger();
    const deps = createMockDeps(ports, ledger);

    const result = await installToolRoutine(
      makeCandidate({ guardSchemaJson: JSON.stringify({ version: "2.0.0" }) }),
      { allowed: true },
      deps,
    );

    assert.equal(result.status, "denied");
    assert.equal(result.reason, "routine_guard_schema_invalid");
    assert.equal(ports.routines.size, 0);
  });

  it("denies routine with scriptable steps under declarative_only policy", async () => {
    const ports = createMockPorts();
    const ledger = createMockLedger();
    const deps = createMockDeps(ports, ledger);

    const result = await installToolRoutine(
      makeCandidate({
        stepsJson: JSON.stringify([
          { stepId: "s1", kind: "scriptable", capabilityId: "moltbook:feed.read", summary: "script", timeoutMs: 100 },
        ]),
      }),
      { allowed: true },
      deps,
    );

    assert.equal(result.status, "denied");
    assert.equal(result.reason, "routine_guard_schema_invalid");
    assert.match(result.detail ?? "", /scriptable.*rejected/);
    assert.equal(ports.routines.size, 0);
  });

  it("denies permission-expanding routine (allowedCapabilities exceed trigger)", async () => {
    const ports = createMockPorts();
    const ledger = createMockLedger();
    const deps = createMockDeps(ports, ledger);

    const guard = makeGuard({ allowedCapabilities: ["moltbook:feed.read", "moltbook:post.publish"] });
    const result = await installToolRoutine(
      makeCandidate({ guardSchemaJson: guardJson(guard) }),
      { allowed: true },
      deps,
    );

    assert.equal(result.status, "denied");
    assert.equal(result.reason, "routine_permission_expansion_denied");
    assert.equal(ports.routines.size, 0);
  });

  it("writes routine_supersede ledger entry when previousRoutineId provided", async () => {
    const ports = createMockPorts();
    const ledger = createMockLedger();
    const deps = createMockDeps(ports, ledger);

    const result = await installToolRoutine(
      makeCandidate({ routineId: "rtn-2", previousRoutineId: "rtn-1" }),
      { allowed: true },
      deps,
    );

    assert.equal(result.status, "active");
    assert.equal(ledger.entries[0].changeKind, "routine_supersede");
    assert.equal(ledger.entries[0].targetId, "rtn-2");
  });
});

// ───────────────────────────────────────────────────────────────
// invokeToolRoutine
// ───────────────────────────────────────────────────────────────

describe("T6.2.2 invokeToolRoutine", () => {
  it("invokes active routine and writes executed trace", async () => {
    const ports = createMockPorts();
    const ledger = createMockLedger();
    const deps = createMockDeps(ports, ledger);

    await installToolRoutine(makeCandidate(), { allowed: true }, deps);

    const result = await invokeToolRoutine("rtn-1", makeInvocationCtx(), deps);

    assert.equal(result.status, "executed");
    assert.ok(result.trace);
    assert.equal(result.trace!.length, 1);
    assert.equal(result.trace![0].outcome, "success");
    assert.ok(result.traceId);

    // Trace persisted.
    const traces = await readRoutineTraces("rtn-1", deps);
    assert.equal(traces.length, 1);
    assert.equal(traces[0].status, "executed");
  });

  it("denies invocation when policy gate rejects and writes denied trace", async () => {
    const ports = createMockPorts();
    const ledger = createMockLedger();
    const deps = createMockDeps(ports, ledger);

    await installToolRoutine(makeCandidate(), { allowed: true }, deps);

    const result = await invokeToolRoutine(
      "rtn-1",
      makeInvocationCtx({ policyAllowed: false, policyReason: "routine_guard_policy_denied" }),
      deps,
    );

    assert.equal(result.status, "denied");
    assert.equal(result.reason, "routine_guard_policy_denied");

    const traces = await readRoutineTraces("rtn-1", deps);
    assert.equal(traces.length, 1);
    assert.equal(traces[0].status, "denied");
  });

  it("denies invocation when routine not found", async () => {
    const ports = createMockPorts();
    const ledger = createMockLedger();
    const deps = createMockDeps(ports, ledger);

    const result = await invokeToolRoutine("nonexistent", makeInvocationCtx(), deps);

    assert.equal(result.status, "denied");
    assert.equal(result.reason, "routine_invocation_denied");
  });

  it("denies invocation when routine is retired", async () => {
    const ports = createMockPorts();
    const ledger = createMockLedger();
    const deps = createMockDeps(ports, ledger);

    await installToolRoutine(makeCandidate(), { allowed: true }, deps);
    await retireToolRoutine("rtn-1", { ...deps, workspaceRoot: "/workspace" });

    const result = await invokeToolRoutine("rtn-1", makeInvocationCtx(), deps);

    assert.equal(result.status, "denied");
    assert.equal(result.reason, "routine_invocation_denied");
  });

  it("records scriptable steps as skipped in trace", async () => {
    const ports = createMockPorts();
    const ledger = createMockLedger();
    const deps = createMockDeps(ports, ledger);

    const guard = makeGuard({ sandboxPolicy: "strict" });
    await installToolRoutine(
      makeCandidate({
        guardSchemaJson: guardJson(guard),
        stepsJson: JSON.stringify([
          { stepId: "s1", kind: "declarative", capabilityId: "moltbook:feed.read", summary: "read", timeoutMs: 100 },
          { stepId: "s2", kind: "scriptable", capabilityId: "moltbook:feed.read", summary: "transform", timeoutMs: 100 },
        ]),
      }),
      { allowed: true },
      deps,
    );

    const result = await invokeToolRoutine("rtn-1", makeInvocationCtx(), deps);

    assert.equal(result.status, "executed");
    assert.equal(result.trace!.length, 2);
    assert.equal(result.trace![0].outcome, "success");
    assert.equal(result.trace![1].outcome, "skipped");
  });
});

// ───────────────────────────────────────────────────────────────
// retireToolRoutine
// ───────────────────────────────────────────────────────────────

describe("T6.2.2 retireToolRoutine", () => {
  it("transitions active routine to retired with ledger entry", async () => {
    const ports = createMockPorts();
    const ledger = createMockLedger();
    const deps = createMockDeps(ports, ledger);

    await installToolRoutine(makeCandidate(), { allowed: true }, deps);
    const result = await retireToolRoutine("rtn-1", { ...deps, workspaceRoot: "/workspace" });

    assert.ok(result.ok);
    assert.ok(result.retiredAt);

    const row = ports.routines.get("rtn-1");
    assert.equal(row!.status, "retired");
    assert.ok(row!.retiredAt);

    // routine_retire ledger entry.
    assert.equal(ledger.entries.length, 2);
    assert.equal(ledger.entries[1].changeKind, "routine_retire");
  });

  it("fails to retire non-existent routine", async () => {
    const ports = createMockPorts();
    const ledger = createMockLedger();
    const deps = createMockDeps(ports, ledger);

    const result = await retireToolRoutine("nonexistent", { ...deps, workspaceRoot: "/workspace" });
    assert.ok(!result.ok);
  });
});

// ───────────────────────────────────────────────────────────────
// Read models
// ───────────────────────────────────────────────────────────────

describe("T6.2.2 read models", () => {
  it("loadActiveRoutine returns active routine", async () => {
    const ports = createMockPorts();
    const ledger = createMockLedger();
    const deps = createMockDeps(ports, ledger);

    await installToolRoutine(makeCandidate(), { allowed: true }, deps);
    const routine = await loadActiveRoutine("rtn-1", deps);
    assert.ok(routine);
    assert.equal(routine!.status, "active");
  });

  it("listRoutinesByStatus filters by status", async () => {
    const ports = createMockPorts();
    const ledger = createMockLedger();
    const deps = createMockDeps(ports, ledger);

    await installToolRoutine(makeCandidate(), { allowed: true }, deps);
    const active = await listRoutinesByStatus("active", deps);
    assert.equal(active.length, 1);
    assert.equal(active[0].routineId, "rtn-1");

    const retired = await listRoutinesByStatus("retired", deps);
    assert.equal(retired.length, 0);
  });
});
