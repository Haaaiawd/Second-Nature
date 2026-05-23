/**
 * Tests for RestoreAuditService — T-OBS.C.6
 *
 * Verification plan §t-obs-c-6:
 *   1. Successful restore → audit entry with fromVersion / toVersion / reason
 *   2. Partial restore → isPartialRestore=true + completedEntities + failedEntities
 *   3. Credential entity excluded → excludedFields listed; credential values absent from payload
 *   4. Audit write failure → fire-and-forget: result.ok=true + warning; no throw
 *   5. Hash chain: second audit entry links previousHash to first entry
 *   6. Audit family is "restore.audit"
 *   7. completedEntities / failedEntities arrays are faithfully recorded
 *   8. Credential values never appear in audit store
 *   9. Audit payload does NOT include actual field values (only metadata)
 *  10. traceId is propagated into envelope
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  writeRestoreAudit,
  type RestoreAuditEvent,
} from "../../../src/observability/services/restore-audit-service.js";
import { AppendOnlyAuditStore } from "../../../src/observability/audit/append-only-audit-store.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<RestoreAuditEvent> = {}): RestoreAuditEvent {
  return {
    id: "evt-restore-001",
    restoreTarget: "narrative",
    fromVersion: "v1",
    toVersion: "v2",
    triggeredBy: "operator",
    reason: "manual recovery after drift",
    completedEntities: ["NarrativeState"],
    failedEntities: [],
    excludedFields: [],
    restoredFieldCount: 5,
    createdAt: "2026-05-01T10:00:00.000Z",
    traceId: "trace-abc-001",
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("writeRestoreAudit — successful restore", () => {
  it("writes audit entry with fromVersion / toVersion / reason", async () => {
    const store = new AppendOnlyAuditStore();
    const event = makeEvent();

    const result = await writeRestoreAudit(event, store);

    assert.equal(result.ok, true);
    assert.deepEqual(result.warnings, []);

    const entries = store.list();
    assert.equal(entries.length, 1);

    const payload = entries[0].payload as Record<string, unknown>;
    assert.equal(payload.fromVersion, "v1");
    assert.equal(payload.toVersion, "v2");
    assert.equal(payload.reason, "manual recovery after drift");
    assert.equal(payload.restoreTarget, "narrative");
    assert.equal(payload.triggeredBy, "operator");
  });

  it("audit family is 'restore.audit'", async () => {
    const store = new AppendOnlyAuditStore();
    await writeRestoreAudit(makeEvent(), store);

    const entries = store.list();
    assert.equal(entries[0].family, "restore.audit");
  });

  it("audit plane is 'governance'", async () => {
    const store = new AppendOnlyAuditStore();
    await writeRestoreAudit(makeEvent(), store);

    assert.equal(store.list()[0].plane, "governance");
  });

  it("traceId is propagated into envelope", async () => {
    const store = new AppendOnlyAuditStore();
    await writeRestoreAudit(makeEvent({ traceId: "trace-xyz-999" }), store);

    assert.equal(store.list()[0].traceId, "trace-xyz-999");
  });

  it("restoredFieldCount is included in payload", async () => {
    const store = new AppendOnlyAuditStore();
    await writeRestoreAudit(makeEvent({ restoredFieldCount: 7 }), store);

    const payload = store.list()[0].payload as Record<string, unknown>;
    assert.equal(payload.restoredFieldCount, 7);
  });
});

describe("writeRestoreAudit — partial restore", () => {
  it("partial restore → isPartialRestore=true + completedEntities + failedEntities", async () => {
    const store = new AppendOnlyAuditStore();
    const event = makeEvent({
      completedEntities: ["NarrativeState", "GoalLifecycle"],
      failedEntities: ["IdentityProfile"],
    });

    const result = await writeRestoreAudit(event, store);
    assert.equal(result.ok, true);

    const payload = store.list()[0].payload as Record<string, unknown>;
    assert.equal(payload.isPartialRestore, true);
    assert.deepEqual(payload.completedEntities, ["NarrativeState", "GoalLifecycle"]);
    assert.deepEqual(payload.failedEntities, ["IdentityProfile"]);
  });

  it("full restore → isPartialRestore=false", async () => {
    const store = new AppendOnlyAuditStore();
    await writeRestoreAudit(
      makeEvent({ completedEntities: ["NarrativeState"], failedEntities: [] }),
      store
    );

    const payload = store.list()[0].payload as Record<string, unknown>;
    assert.equal(payload.isPartialRestore, false);
  });

  it("completedEntities / failedEntities arrays faithfully recorded", async () => {
    const store = new AppendOnlyAuditStore();
    await writeRestoreAudit(
      makeEvent({
        completedEntities: ["A", "B", "C"],
        failedEntities: ["D", "E"],
      }),
      store
    );

    const payload = store.list()[0].payload as Record<string, unknown>;
    assert.deepEqual(payload.completedEntities, ["A", "B", "C"]);
    assert.deepEqual(payload.failedEntities, ["D", "E"]);
  });
});

describe("writeRestoreAudit — credential exclusion", () => {
  it("excludedFields listed in audit; credential values absent from payload", async () => {
    const store = new AppendOnlyAuditStore();
    const event = makeEvent({
      excludedFields: ["encryption_key", "credential_value", "token"],
    });

    await writeRestoreAudit(event, store);

    const payload = store.list()[0].payload as Record<string, unknown>;

    // Field names should be listed
    assert.deepEqual(payload.excludedFields, [
      "encryption_key",
      "credential_value",
      "token",
    ]);

    // The actual values should NOT appear
    const payloadStr = JSON.stringify(payload).toLowerCase();
    const forbidden = ["secret", "password", "key_value", "raw_key"];
    for (const f of forbidden) {
      assert.ok(!payloadStr.includes(f), `payload must not contain "${f}"`);
    }
  });

  it("audit payload has no actual field values — only metadata", async () => {
    const store = new AppendOnlyAuditStore();
    await writeRestoreAudit(
      makeEvent({
        excludedFields: ["secret_key"],
        completedEntities: ["NarrativeState"],
      }),
      store
    );

    const payload = store.list()[0].payload as Record<string, unknown>;

    // Allowed metadata keys in payload
    const allowedKeys = [
      "restoreTarget",
      "fromVersion",
      "toVersion",
      "triggeredBy",
      "reason",
      "completedEntities",
      "failedEntities",
      "excludedFields",
      "restoredFieldCount",
      "isPartialRestore",
      "createdAt",
    ];

    const payloadKeys = Object.keys(payload);
    for (const key of payloadKeys) {
      assert.ok(
        allowedKeys.includes(key),
        `unexpected payload key "${key}" — actual field values must not be stored`
      );
    }
  });
});

describe("writeRestoreAudit — fire-and-forget failure", () => {
  it("audit store append failure → ok=true + warning; no throw", async () => {
    // Create a store with a broken append that throws
    const store = new AppendOnlyAuditStore();
    // Inject a first entry then seed a different hash to cause mismatch
    // (simulates hash chain corruption)
    const brokenStore = {
      list: () => [],
      lastRecordHash: () => "nonexistent_hash",
      append: () => { throw new Error("audit_previous_hash_mismatch"); },
      seedFamilyHash: () => {},
    } as unknown as AppendOnlyAuditStore;

    const result = await writeRestoreAudit(makeEvent(), brokenStore);

    assert.equal(result.ok, true, "ok must be true even when audit fails");
    assert.equal(result.warnings.length, 1);
    assert.ok(
      result.warnings[0].startsWith("audit_write_failed:"),
      `warning should start with 'audit_write_failed:', got: ${result.warnings[0]}`
    );
  });
});

describe("writeRestoreAudit — hash chain", () => {
  it("second audit entry previousHash links to first entry", async () => {
    const store = new AppendOnlyAuditStore();

    await writeRestoreAudit(makeEvent({ id: "evt-001", traceId: "trace-1" }), store);
    await writeRestoreAudit(
      makeEvent({ id: "evt-002", traceId: "trace-2", createdAt: "2026-05-01T10:01:00.000Z" }),
      store
    );

    const entries = store.list();
    assert.equal(entries.length, 2);

    const firstHash = entries[0].integrity.recordHash;
    const secondPreviousHash = entries[1].integrity.previousHash;

    assert.equal(
      secondPreviousHash,
      firstHash,
      "second entry previousHash must equal first entry recordHash"
    );
  });
});
