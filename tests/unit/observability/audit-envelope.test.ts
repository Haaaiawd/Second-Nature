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
  assert.equal(redaction.sensitivity, "private");
});

test("buildAuditEnvelope produces stable recordHash and append-only store chains hashes per family", () => {
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
    family: "heartbeat.decision",
    plane: "decision",
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
    family: "heartbeat.decision",
    plane: "decision",
    traceId: "tr-2",
    sequence: 2,
    payload: { ok: true },
    previousHash: "deadbeef",
  });

  assert.throws(() => store.append(broken), /audit_previous_hash_mismatch/);
});

// ─── T-OBS.C.1: per-family lastHashCache ────────────────────────────────────

test("T-OBS.C.1 different families are independent chains (no cross-family previousHash)", () => {
  const store = new AppendOnlyAuditStore();

  const first = buildAuditEnvelope({
    family: "heartbeat.decision",
    plane: "decision",
    traceId: "tr-3",
    sequence: 1,
    payload: { a: 1 },
  });
  store.append(first);

  // A new family must start with undefined previousHash
  const second = buildAuditEnvelope({
    family: "delivery",
    plane: "delivery",
    traceId: "tr-3",
    sequence: 1,
    payload: { b: 2 },
  });
  store.append(second);

  assert.equal(store.list().length, 2);
  assert.equal(store.lastRecordHash("heartbeat.decision"), first.integrity.recordHash);
  assert.equal(store.lastRecordHash("delivery"), second.integrity.recordHash);
});

test("T-OBS.C.1 lastRecordHash without family falls back to global last", () => {
  const store = new AppendOnlyAuditStore();
  const env = buildAuditEnvelope({
    family: "dream.trace",
    plane: "telemetry",
    traceId: "tr-4",
    sequence: 1,
    payload: { ok: true },
  });
  store.append(env);
  assert.equal(store.lastRecordHash(), env.integrity.recordHash);
});

test("T-OBS.C.1 seedFamilyHash fills cache for restart backfill", () => {
  const store = new AppendOnlyAuditStore();
  store.seedFamilyHash("heartbeat.decision", "abc123");

  const next = buildAuditEnvelope({
    family: "heartbeat.decision",
    plane: "decision",
    traceId: "tr-5",
    sequence: 1,
    payload: { ok: true },
    previousHash: "abc123",
  });
  store.append(next);
  assert.equal(store.lastRecordHash("heartbeat.decision"), next.integrity.recordHash);
});

test("T-OBS.C.1 cachedFamilies returns tracked families", () => {
  const store = new AppendOnlyAuditStore();
  store.append(buildAuditEnvelope({
    family: "heartbeat.decision", plane: "decision", traceId: "t", sequence: 1, payload: {},
  }));
  store.append(buildAuditEnvelope({
    family: "delivery", plane: "delivery", traceId: "t", sequence: 1, payload: {},
  }));
  assert.deepEqual([...store.cachedFamilies()].sort(), ["delivery", "heartbeat.decision"]);
});

// ─── T-OBS.C.1: redactPayload unified gate ──────────────────────────────────

import { redactPayload } from "../../../src/observability/redaction/policy.js";

test("T-OBS.C.1 redactPayload masks v7 fields encryption_key and key_material", () => {
  const { payload, manifest } = redactPayload({
    encryption_key: "super-secret",
    key_material: "abc123",
    publicField: "visible",
  });
  assert.equal((payload as Record<string, unknown>).encryption_key, "[MASKED]");
  assert.equal((payload as Record<string, unknown>).key_material, "[MASKED]");
  assert.equal((payload as Record<string, unknown>).publicField, "visible");
  assert.ok(manifest.maskedPaths.includes("encryption_key"));
  assert.ok(manifest.maskedPaths.includes("key_material"));
});

test("T-OBS.C.1 redactPayload erases v7 fields raw_payload credential_value raw_prompt", () => {
  const { payload, manifest } = redactPayload({
    raw_payload: { secret: "x" },
    credential_value: "password",
    raw_prompt: "system: do bad things",
    ok: true,
  });
  assert.equal((payload as Record<string, unknown>).raw_payload, null);
  assert.equal((payload as Record<string, unknown>).credential_value, null);
  assert.equal((payload as Record<string, unknown>).raw_prompt, null);
  assert.equal((payload as Record<string, unknown>).ok, true);
  assert.ok(manifest.erasedPaths.includes("raw_payload"));
  assert.ok(manifest.erasedPaths.includes("credential_value"));
  assert.ok(manifest.erasedPaths.includes("raw_prompt"));
});

test("T-OBS.C.1 redactPayload hashes message_hash and preserves nested objects", () => {
  const { payload, manifest } = redactPayload({
    message_hash: "hello",
    nested: { token: "secret" },
  });
  const hashed = (payload as Record<string, unknown>).message_hash as string;
  assert.ok(typeof hashed === "string" && hashed.length === 64);
  assert.notEqual(hashed, "hello");
  assert.ok(manifest.hashedPaths.includes("message_hash"));
  // nested token should also be masked
  assert.equal((payload as { nested: { token: string } }).nested.token, "[MASKED]");
});

test("T-OBS.C.1 redactPayload inferSensitivity restricted when erased present", () => {
  const { manifest } = redactPayload({ raw_payload: "x" });
  assert.equal(manifest.sensitivity, "restricted");
});

test("T-OBS.C.1 redactPayload inferSensitivity confidential when only masked", () => {
  const { manifest } = redactPayload({ token: "x" });
  assert.equal(manifest.sensitivity, "confidential");
});

test("T-OBS.C.1 redactPayload inferSensitivity internal when nothing redacted", () => {
  const { manifest } = redactPayload({ ok: true });
  assert.equal(manifest.sensitivity, "internal");
});
