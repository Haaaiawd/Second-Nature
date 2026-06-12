/**
 * Heartbeat Denial Attribution — Unit Tests (T-OBS.R.4)
 *
 * Validates: action closures are classified into policy/hard-guard/cooldown/
 * source-absence/quiet-suppression/connector-terminal buckets.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { attributeDenials } from "../../../src/observability/loop-status.js";
import { writeActionClosureRecord } from "../../../src/storage/v8-state-stores.js";

describe("heartbeat-denial-attribution", () => {
  function makeClosure(day: string, overrides: Record<string, unknown>) {
    return {
      id: `closure_${day}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      cycleId: `cycle_${day}`,
      status: "denied" as const,
      closureStatus: "denied" as const,
      inputSummary: "test",
      outputSummary: "done",
      postProcessing: [],
      nextState: "ok",
      reason: "policy_denied_high_risk",
      sourceRefs: [
        { uri: "sn://test", family: "action_closure" as const, id: "c1", redactionClass: "none" as const, resolveStatus: "resolvable" as const },
      ],
      createdAt: `${day}T12:00:00Z`,
      closedAt: `${day}T12:00:00Z`,
      dispatchAttempt: 1,
      ...overrides,
    };
  }

  it("classifies policy_denied as policy", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const day = "2026-06-12";
      await writeActionClosureRecord(db, makeClosure(day, { reason: "policy_denied_high_risk" }));
      const attr = await attributeDenials(db, { day });
      assert.equal(attr.policyDeniedCount, 1);
      assert.equal(attr.hardGuardDeniedCount, 0);
    } finally {
      db.close();
    }
  });

  it("classifies missing source refs as hard guard", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const day = "2026-06-12";
      await writeActionClosureRecord(db, makeClosure(day, { reason: "source_refs_missing" }));
      const attr = await attributeDenials(db, { day });
      assert.equal(attr.hardGuardDeniedCount, 1);
      assert.equal(attr.policyDeniedCount, 0);
    } finally {
      db.close();
    }
  });

  it("classifies evidence_batch_empty as source absence", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const day = "2026-06-12";
      await writeActionClosureRecord(db, makeClosure(day, { status: "no_action", closureStatus: "no_action", reason: "evidence_batch_empty" }));
      const attr = await attributeDenials(db, { day });
      assert.equal(attr.sourceAbsenceCount, 1);
    } finally {
      db.close();
    }
  });

  it("classifies guidance_unavailable as quiet suppression", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const day = "2026-06-12";
      await writeActionClosureRecord(db, makeClosure(day, { status: "downgraded", closureStatus: "downgraded", reason: "guidance_unavailable" }));
      const attr = await attributeDenials(db, { day });
      assert.equal(attr.quietSuppressionCount, 1);
    } finally {
      db.close();
    }
  });

  it("classifies auth_failure as connector terminal", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const day = "2026-06-12";
      await writeActionClosureRecord(db, makeClosure(day, { status: "completed", closureStatus: "completed", reason: "auth_failure" }));
      const attr = await attributeDenials(db, { day });
      assert.equal(attr.connectorTerminalCount, 1);
    } finally {
      db.close();
    }
  });

  it("returns zero counts when state is empty", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const attr = await attributeDenials(db, { day: "2026-06-12" });
      assert.equal(attr.policyDeniedCount, 0);
      assert.equal(attr.hardGuardDeniedCount, 0);
      assert.equal(attr.cooldownReplayCount, 0);
      assert.equal(attr.sourceAbsenceCount, 0);
      assert.equal(attr.quietSuppressionCount, 0);
      assert.equal(attr.connectorTerminalCount, 0);
    } finally {
      db.close();
    }
  });
});
