import test from "node:test";
import assert from "node:assert/strict";

import { AppendOnlyAuditStore } from "../../../src/observability/audit/append-only-audit-store.js";
import { buildAuditEnvelope } from "../../../src/observability/audit/audit-envelope.js";
import {
  verifyAuditHashChain,
  createAppendOnlyAuditStoreRangeLoader,
} from "../../../src/observability/audit/verify-audit-hash-chain.js";

test("T5.2.2 verifyAuditHashChain — pass on valid chain", async () => {
  const store = new AppendOnlyAuditStore();
  const t0 = "2026-05-02T10:00:00.000Z";
  const t1 = "2026-05-02T10:00:01.000Z";
  const first = buildAuditEnvelope({
    family: "heartbeat.decision",
    plane: "decision",
    traceId: "tr",
    sequence: 1,
    payload: { a: 1 },
    createdAt: t0,
  });
  store.append(first);
  const second = buildAuditEnvelope({
    family: "heartbeat.decision",
    plane: "decision",
    traceId: "tr",
    sequence: 2,
    payload: { b: 2 },
    previousHash: first.integrity.recordHash,
    createdAt: t1,
  });
  store.append(second);

  const deps = createAppendOnlyAuditStoreRangeLoader(store);
  const report = await verifyAuditHashChain({ from: t0, to: t1 }, deps);
  assert.equal(report.status, "pass");
  assert.equal(report.checkedEventCount, 2);
  assert.deepEqual(report.reasons, ["hash_chain_valid"]);
});

test("T5.2.2 recordHash mismatch → broken", async () => {
  const store = new AppendOnlyAuditStore();
  const t0 = "2026-05-02T11:00:00.000Z";
  const env = buildAuditEnvelope({
    family: "heartbeat.decision",
    plane: "decision",
    traceId: "tr2",
    sequence: 1,
    payload: { x: 1 },
    createdAt: t0,
  });
  const tampered = {
    ...env,
    payload: { x: 999 },
    integrity: { ...env.integrity },
  };
  store.append(tampered as typeof env);

  const report = await verifyAuditHashChain(
    { from: t0, to: t0 },
    createAppendOnlyAuditStoreRangeLoader(store),
  );
  assert.equal(report.status, "broken");
  assert.ok(report.brokenAtEventIds.includes(env.eventId));
});

test("T5.2.2 previousHash link broken in verified slice → broken", async () => {
  const t0 = "2026-05-02T12:00:00.000Z";
  const first = buildAuditEnvelope({
    family: "heartbeat.decision",
    plane: "decision",
    traceId: "tr3",
    sequence: 1,
    payload: { ok: true },
    createdAt: t0,
  });
  const second = buildAuditEnvelope({
    family: "delivery",
    plane: "delivery",
    traceId: "tr3",
    sequence: 2,
    payload: { ok: true },
    previousHash: first.integrity.recordHash,
    createdAt: t0,
  });
  const brokenSecond = {
    ...second,
    integrity: { ...second.integrity, previousHash: "0".repeat(64) },
  };
  const report = await verifyAuditHashChain(
    { from: t0, to: t0 },
    { loadRange: async () => [first, brokenSecond] },
  );
  assert.equal(report.status, "broken");
  assert.ok(report.brokenAtEventIds.includes(second.eventId));
});

test("T5.2.2 empty range → incomplete", async () => {
  const store = new AppendOnlyAuditStore();
  const report = await verifyAuditHashChain(
    { from: "2026-05-02T20:00:00.000Z", to: "2026-05-02T20:59:59.000Z" },
    createAppendOnlyAuditStoreRangeLoader(store),
  );
  assert.equal(report.status, "incomplete");
  assert.deepEqual(report.reasons, ["range_empty"]);
});

test("T5.2.2 invalid from>to → incomplete", async () => {
  const report = await verifyAuditHashChain(
    { from: "2026-05-03T00:00:00.000Z", to: "2026-05-02T00:00:00.000Z" },
    { loadRange: async () => [] },
  );
  assert.equal(report.status, "incomplete");
  assert.ok(report.reasons.includes("invalid_range_from_after_to"));
});
