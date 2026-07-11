/**
 * v9 RuntimeOpsEnvelopeFactory — Unit Tests (T1.2.2)
 *
 * Validates:
 * - classifySensitiveField: credential/private/prompt/none
 * - redactOpsPayload: credential blocking, private redaction, prompt hashing
 * - capEvidenceLevel: carrier mode cap
 * - promoteEvidence: monotonic promotion
 * - assembleEnvelope: full envelope assembly with redaction + truth gate
 * - DiagnosticsCollector: redactedKeys tracking
 * - Batch redaction
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  assembleEnvelope,
  redactOpsPayload,
  redactOpsPayloadBatch,
  classifySensitiveField,
  capEvidenceLevel,
  promoteEvidence,
  createDiagnosticsCollector,
  type SensitiveKind,
} from "../../../src/cli/ops/v9-envelope-factory.js";
import type { EvidenceLevel, SurfaceMode } from "../../../src/shared/types/v9-contracts.js";

// ───────────────────────────────────────────────────────────────
// classifySensitiveField
// ───────────────────────────────────────────────────────────────

describe("T1.2.2 classifySensitiveField", () => {
  it("classifies credential keys", () => {
    assert.equal(classifySensitiveField("token"), "credential");
    assert.equal(classifySensitiveField("password"), "credential");
    assert.equal(classifySensitiveField("api_key"), "credential");
    assert.equal(classifySensitiveField("apiKey"), "credential");
    assert.equal(classifySensitiveField("secret"), "credential");
    assert.equal(classifySensitiveField("SECOND_NATURE_ENCRYPTION_KEY"), "credential");
    assert.equal(classifySensitiveField("credential"), "credential");
    assert.equal(classifySensitiveField("bearer"), "credential");
    assert.equal(classifySensitiveField("authorization"), "credential");
  });

  it("classifies private content keys", () => {
    assert.equal(classifySensitiveField("email"), "private");
    assert.equal(classifySensitiveField("phone"), "private");
    assert.equal(classifySensitiveField("message_body"), "private");
    assert.equal(classifySensitiveField("dm_content"), "private");
    assert.equal(classifySensitiveField("private_content"), "private");
  });

  it("classifies prompt keys", () => {
    assert.equal(classifySensitiveField("prompt"), "prompt");
    assert.equal(classifySensitiveField("system_prompt"), "prompt");
    assert.equal(classifySensitiveField("agent_prompt"), "prompt");
    assert.equal(classifySensitiveField("raw_prompt"), "prompt");
  });

  it("returns none for non-sensitive keys", () => {
    assert.equal(classifySensitiveField("routineId"), "none");
    assert.equal(classifySensitiveField("status"), "none");
    assert.equal(classifySensitiveField("version"), "none");
    assert.equal(classifySensitiveField("sourceRefs"), "none");
  });
});

// ───────────────────────────────────────────────────────────────
// redactOpsPayload
// ───────────────────────────────────────────────────────────────

describe("T1.2.2 redactOpsPayload", () => {
  it("redacts credential fields", () => {
    const payload = { token: "abc123", data: "normal" };
    const { redacted, diagnostics } = redactOpsPayload(payload);
    assert.equal((redacted as any).token, "<redacted:credential>");
    assert.equal((redacted as any).data, "normal");
    assert.ok(diagnostics.redactedKeys.includes("token"));
    assert.ok(diagnostics.credentialBlocked);
  });

  it("redacts private content fields", () => {
    const payload = { email: "user@example.com", name: "Alice" };
    const { redacted, diagnostics } = redactOpsPayload(payload);
    assert.equal((redacted as any).email, "<redacted:private>");
    assert.equal((redacted as any).name, "Alice");
    assert.ok(diagnostics.privateContentRedacted);
  });

  it("redacts prompt fields with hash", () => {
    const payload = { prompt: "You are a helpful assistant", data: "normal" };
    const { redacted, diagnostics } = redactOpsPayload(payload);
    assert.match((redacted as any).prompt, /^prompt_redacted:[a-f0-9]+$/);
    assert.equal((redacted as any).data, "normal");
    assert.ok(diagnostics.promptRedacted);
  });

  it("redacts nested credential fields", () => {
    const payload = { outer: { inner: { api_key: "sk-1234567890abcdef" } } };
    const { redacted, diagnostics } = redactOpsPayload(payload);
    assert.equal((redacted as any).outer.inner.api_key, "<redacted:credential>");
    assert.ok(diagnostics.redactedKeys.some((k) => k.includes("api_key")));
  });

  it("redacts credential values in array elements", () => {
    const payload = { items: [{ token: "secret123" }, { name: "ok" }] };
    const { redacted, diagnostics } = redactOpsPayload(payload);
    assert.equal((redacted as any).items[0].token, "<redacted:credential>");
    assert.equal((redacted as any).items[1].name, "ok");
  });

  it("preserves non-sensitive fields", () => {
    const payload = { routineId: "r1", status: "installed", version: "1.0.0" };
    const { redacted, diagnostics } = redactOpsPayload(payload);
    assert.deepEqual(redacted, payload);
    assert.equal(diagnostics.redactedKeys.length, 0);
  });

  it("handles null and undefined", () => {
    const payload = { a: null, b: undefined, token: "secret" };
    const { redacted } = redactOpsPayload(payload);
    assert.equal((redacted as any).a, null);
    assert.equal((redacted as any).b, undefined);
    assert.equal((redacted as any).token, "<redacted:credential>");
  });

  it("handles empty string credential", () => {
    const payload = { token: "" };
    const { redacted } = redactOpsPayload(payload);
    // Empty string with credential key — not redacted (no value to leak)
    assert.equal((redacted as any).token, "");
  });

  it("redacts JWT-like values in arbitrary string fields", () => {
    const payload = { data: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c" };
    const { redacted, diagnostics } = redactOpsPayload(payload);
    // JWT pattern detected by containsCredentialValue
    assert.equal((redacted as any).data, "<redacted:credential>");
    assert.ok(diagnostics.credentialBlocked);
  });

  it("respects depth limit", () => {
    // Create deeply nested object (depth > 10)
    let obj: any = "deep_value";
    for (let i = 0; i < 15; i++) {
      obj = { nested: obj };
    }
    const { redacted } = redactOpsPayload(obj);
    // Should not crash, deep value preserved (depth limit hit)
    assert.ok(typeof redacted === "object");
  });
});

// ───────────────────────────────────────────────────────────────
// capEvidenceLevel
// ───────────────────────────────────────────────────────────────

describe("T1.2.2 capEvidenceLevel", () => {
  it("caps to carrier_ack in carrier mode", () => {
    assert.equal(capEvidenceLevel("durable_verified", "carrier"), "carrier_ack");
    assert.equal(capEvidenceLevel("real_runtime", "carrier"), "carrier_ack");
    assert.equal(capEvidenceLevel("state_present", "carrier"), "carrier_ack");
  });

  it("does not cap in full_runtime mode", () => {
    assert.equal(capEvidenceLevel("durable_verified", "full_runtime"), "durable_verified");
    assert.equal(capEvidenceLevel("real_runtime", "full_runtime"), "real_runtime");
  });

  it("does not cap in workspace_full_runtime mode", () => {
    assert.equal(capEvidenceLevel("durable_verified", "workspace_full_runtime"), "durable_verified");
  });
});

// ───────────────────────────────────────────────────────────────
// promoteEvidence
// ───────────────────────────────────────────────────────────────

describe("T1.2.2 promoteEvidence", () => {
  it("promotes from carrier_ack to state_present with sourceRefs", () => {
    assert.equal(
      promoteEvidence("carrier_ack", { hasSourceRefs: true }),
      "state_present",
    );
  });

  it("promotes to real_runtime with realRuntimeProof", () => {
    assert.equal(
      promoteEvidence("state_present", { hasRealRuntimeProof: true }),
      "real_runtime",
    );
  });

  it("promotes to durable_verified with durableAudit", () => {
    assert.equal(
      promoteEvidence("real_runtime", { hasDurableAudit: true }),
      "durable_verified",
    );
  });

  it("is monotonic — does not demote", () => {
    assert.equal(
      promoteEvidence("durable_verified", { hasSourceRefs: false }),
      "durable_verified",
    );
  });

  it("handles multiple signals", () => {
    assert.equal(
      promoteEvidence("carrier_ack", {
        hasSourceRefs: true,
        hasRealRuntimeProof: true,
        hasDurableAudit: true,
      }),
      "durable_verified",
    );
  });
});

// ───────────────────────────────────────────────────────────────
// assembleEnvelope
// ───────────────────────────────────────────────────────────────

describe("T1.2.2 assembleEnvelope", () => {
  it("assembles envelope with redacted payload", () => {
    const envelope = assembleEnvelope({
      ok: true,
      command: "continuity.read",
      payload: { token: "secret", data: "normal" },
      surfaceMode: "full_runtime",
    });
    assert.equal(envelope.ok, true);
    assert.equal(envelope.command, "continuity.read");
    assert.equal((envelope.payload as any).token, "<redacted:credential>");
    assert.equal((envelope.payload as any).data, "normal");
    assert.ok(envelope.diagnostics.redactedKeys?.includes("token"));
  });

  it("caps evidence level in carrier mode", () => {
    const envelope = assembleEnvelope({
      ok: true,
      command: "loop_status.read",
      payload: {},
      surfaceMode: "carrier",
      evidenceLevel: "durable_verified",
    });
    assert.equal(envelope.evidenceLevel, "carrier_ack");
  });

  it("promotes evidence level with proof signals", () => {
    const envelope = assembleEnvelope({
      ok: true,
      command: "routine.list",
      payload: [],
      surfaceMode: "full_runtime",
      proofSignals: { hasSourceRefs: true, hasRealRuntimeProof: true },
    });
    assert.equal(envelope.evidenceLevel, "real_runtime");
  });

  it("includes degradedReasons", () => {
    const envelope = assembleEnvelope({
      ok: false,
      command: "continuity.read",
      payload: {},
      surfaceMode: "carrier",
      degradedReasons: [{ code: "host_tool_unavailable", message: "test" }],
    });
    assert.equal(envelope.degradedReasons.length, 1);
    assert.equal(envelope.degradedReasons[0].code, "host_tool_unavailable");
  });

  it("includes sourceRefs", () => {
    const envelope = assembleEnvelope({
      ok: true,
      command: "routine.show",
      payload: {},
      surfaceMode: "full_runtime",
      sourceRefs: [{ family: "evidence", id: "e1" }],
    });
    assert.equal(envelope.sourceRefs.length, 1);
  });

  it("generates timestamp if not provided", () => {
    const envelope = assembleEnvelope({
      ok: true,
      command: "test",
      payload: {},
      surfaceMode: "full_runtime",
    });
    assert.ok(envelope.generatedAt);
    assert.equal(typeof envelope.generatedAt, "string");
  });

  it("uses provided timestamp", () => {
    const envelope = assembleEnvelope({
      ok: true,
      command: "test",
      payload: {},
      surfaceMode: "full_runtime",
      generatedAt: "2026-06-28T10:00:00Z",
    });
    assert.equal(envelope.generatedAt, "2026-06-28T10:00:00Z");
  });

  it("envelope is JSON-serializable", () => {
    const envelope = assembleEnvelope({
      ok: true,
      command: "test",
      payload: { token: "secret", data: "normal" },
      surfaceMode: "full_runtime",
    });
    assert.doesNotThrow(() => JSON.stringify(envelope));
  });

  it("redacts prompt fields with hash prefix", () => {
    const envelope = assembleEnvelope({
      ok: true,
      command: "test",
      payload: { prompt: "You are an agent" },
      surfaceMode: "full_runtime",
    });
    assert.match((envelope.payload as any).prompt, /^prompt_redacted:[a-f0-9]+$/);
  });
});

// ───────────────────────────────────────────────────────────────
// DiagnosticsCollector
// ───────────────────────────────────────────────────────────────

describe("T1.2.2 DiagnosticsCollector", () => {
  it("collects redacted keys", () => {
    const collector = createDiagnosticsCollector();
    collector.collect("token", "credential");
    collector.collect("email", "private");
    collector.collect("prompt", "prompt");
    const result = collector.result();
    assert.equal(result.redactedKeys.length, 3);
    assert.ok(result.credentialBlocked);
    assert.ok(result.privateContentRedacted);
    assert.ok(result.promptRedacted);
  });

  it("starts empty", () => {
    const collector = createDiagnosticsCollector();
    const result = collector.result();
    assert.equal(result.redactedKeys.length, 0);
    assert.equal(result.credentialBlocked, false);
    assert.equal(result.privateContentRedacted, false);
    assert.equal(result.promptRedacted, false);
  });
});

// ───────────────────────────────────────────────────────────────
// redactOpsPayloadBatch
// ───────────────────────────────────────────────────────────────

describe("T1.2.2 redactOpsPayloadBatch", () => {
  it("redacts multiple payloads", () => {
    const payloads = [
      { token: "secret1" },
      { email: "user@example.com" },
      { data: "normal" },
    ];
    const { redacted, allRedactedKeys } = redactOpsPayloadBatch(payloads);
    assert.equal(redacted.length, 3);
    assert.equal((redacted[0] as any).token, "<redacted:credential>");
    assert.equal((redacted[1] as any).email, "<redacted:private>");
    assert.equal((redacted[2] as any).data, "normal");
    assert.ok(allRedactedKeys.includes("token"));
    assert.ok(allRedactedKeys.includes("email"));
  });

  it("handles empty array", () => {
    const { redacted, allRedactedKeys } = redactOpsPayloadBatch([]);
    assert.equal(redacted.length, 0);
    assert.equal(allRedactedKeys.length, 0);
  });
});
