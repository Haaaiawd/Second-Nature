import test from "node:test";
import assert from "node:assert/strict";

import { AppendOnlyAuditStore } from "../../../src/observability/audit/append-only-audit-store.js";
import { buildAuditEnvelope, redactAuditEvent } from "../../../src/observability/audit/audit-envelope.js";

test("redactAuditEvent masks token-like fields and records manifest paths", () => {
  const { payload, redaction } = redactAuditEvent({
    traceId: "t1",
    token: "secret-token",
    message: "ok",
  });
  assert.equal((payload as { token: string }).token, "[MASKED]");
  assert.ok(redaction.maskedPaths.some((p) => p.includes("token")));
  assert.equal(redaction.sensitivity, "internal");
});

test("buildAuditEnvelope produces stable recordHash and append-only store chains hashes", () => {
  const store = new AppendOnlyAuditStore();

  const first = buildAuditEnvelope({
    family: "heartbeat.decision",
    plane: "decision",
    traceId: "tr-1",
    sequence: 1,
    payload: { decisionId: "d1", token: "x" },
  });

  store.append(first);

  const second = buildAuditEnvelope({
    family: "delivery",
    plane: "delivery",
    traceId: "tr-1",
    sequence: 2,
    payload: { auditId: "a1" },
    previousHash: first.integrity.recordHash,
  });

  store.append(second);
  assert.equal(store.list().length, 2);
  assert.equal(second.integrity.previousHash, first.integrity.recordHash);
});

test("AppendOnlyAuditStore rejects mismatched previousHash", () => {
  const store = new AppendOnlyAuditStore();
  const first = buildAuditEnvelope({
    family: "heartbeat.decision",
    plane: "decision",
    traceId: "tr-2",
    sequence: 1,
    payload: { ok: true },
  });
  store.append(first);

  const broken = buildAuditEnvelope({
    family: "delivery",
    plane: "delivery",
    traceId: "tr-2",
    sequence: 2,
    payload: { ok: true },
    previousHash: "deadbeef",
  });

  assert.throws(() => store.append(broken), /audit_previous_hash_mismatch/);
});
