/**
 * v9 Ops Redaction Envelope — API Tests (T1.2.2)
 *
 * Validates that ops envelope assembly with sensitive payloads
 * correctly redacts, blocks credentials, and applies truth gate.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  assembleEnvelope,
  redactOpsPayload,
  classifySensitiveField,
  capEvidenceLevel,
} from "../../../src/cli/ops/v9-envelope-factory.js";
import type { RuntimeOpsEnvelopeV9 } from "../../../src/shared/types/v9-contracts.js";

describe("API v9-redaction-envelope", () => {
  it("envelope with credential payload redacts and blocks", () => {
    const envelope = assembleEnvelope({
      ok: true,
      command: "continuity.read",
      payload: {
        token: "sk-abc123def456",
        card: { summary: "test", bodyIntuition: "normal" },
      },
      surfaceMode: "full_runtime",
    });
    assert.equal((envelope.payload as any).token, "<redacted:credential>");
    assert.equal((envelope.payload as any).card.summary, "test");
    assert.ok(envelope.diagnostics.redactedKeys?.includes("token"));
  });

  it("envelope with private content redacts email/phone", () => {
    const envelope = assembleEnvelope({
      ok: true,
      command: "routine.list",
      payload: {
        routines: [{ routineId: "r1", email: "user@example.com", phone: "1234567890" }],
      },
      surfaceMode: "full_runtime",
    });
    const routines = (envelope.payload as any).routines;
    assert.equal(routines[0].routineId, "r1");
    assert.equal(routines[0].email, "<redacted:private>");
    assert.equal(routines[0].phone, "<redacted:private>");
  });

  it("envelope with prompt field hashes the prompt", () => {
    const envelope = assembleEnvelope({
      ok: true,
      command: "test",
      payload: { prompt: "You are a helpful assistant", data: "ok" },
      surfaceMode: "full_runtime",
    });
    assert.match((envelope.payload as any).prompt, /^prompt_redacted:[a-f0-9]+$/);
    assert.equal((envelope.payload as any).data, "ok");
  });

  it("carrier mode caps evidence level to carrier_ack", () => {
    const envelope = assembleEnvelope({
      ok: true,
      command: "loop_status.read",
      payload: {},
      surfaceMode: "carrier",
      evidenceLevel: "durable_verified",
      proofSignals: { hasDurableAudit: true },
    });
    assert.equal(envelope.evidenceLevel, "carrier_ack");
  });

  it("full_runtime mode does not cap evidence level", () => {
    const envelope = assembleEnvelope({
      ok: true,
      command: "loop_status.read",
      payload: {},
      surfaceMode: "full_runtime",
      evidenceLevel: "durable_verified",
    });
    assert.equal(envelope.evidenceLevel, "durable_verified");
  });

  it("evidence level not promoted without proof signals", () => {
    const envelope = assembleEnvelope({
      ok: true,
      command: "routine.list",
      payload: [],
      surfaceMode: "full_runtime",
    });
    assert.equal(envelope.evidenceLevel, "contract_smoke");
  });

  it("evidence level promoted with sourceRefs", () => {
    const envelope = assembleEnvelope({
      ok: true,
      command: "routine.show",
      payload: { routineId: "r1" },
      surfaceMode: "full_runtime",
      sourceRefs: [{ family: "evidence", id: "e1" }],
      proofSignals: { hasSourceRefs: true },
    });
    assert.equal(envelope.evidenceLevel, "state_present");
  });

  it("envelope is JSON-serializable with redacted payload", () => {
    const envelope = assembleEnvelope({
      ok: true,
      command: "test",
      payload: { token: "secret", data: "normal", nested: { api_key: "key123" } },
      surfaceMode: "full_runtime",
    });
    const json = JSON.stringify(envelope);
    assert.ok(json.length > 0);
    assert.ok(!json.includes("secret"));
    assert.ok(!json.includes("key123"));
    const parsed = JSON.parse(json);
    assert.equal(parsed.payload.token, "<redacted:credential>");
    assert.equal(parsed.payload.nested.api_key, "<redacted:credential>");
  });

  it("redaction diagnostics track all redacted keys", () => {
    const envelope = assembleEnvelope({
      ok: true,
      command: "test",
      payload: {
        token: "secret",
        email: "user@example.com",
        prompt: "system prompt",
        normal: "data",
      },
      surfaceMode: "full_runtime",
    });
    const keys = envelope.diagnostics.redactedKeys ?? [];
    assert.ok(keys.includes("token"));
    assert.ok(keys.includes("email"));
    assert.ok(keys.includes("prompt"));
    assert.ok(!keys.includes("normal"));
  });

  it("truth gate: carrier mode with proof signals still caps to carrier_ack", () => {
    const envelope = assembleEnvelope({
      ok: true,
      command: "test",
      payload: {},
      surfaceMode: "carrier",
      proofSignals: { hasSourceRefs: true, hasRealRuntimeProof: true, hasDurableAudit: true },
    });
    assert.equal(envelope.evidenceLevel, "carrier_ack");
  });

  it("workspace_full_runtime mode allows full evidence promotion", () => {
    const envelope = assembleEnvelope({
      ok: true,
      command: "test",
      payload: {},
      surfaceMode: "workspace_full_runtime",
      proofSignals: { hasSourceRefs: true, hasRealRuntimeProof: true, hasDurableAudit: true },
    });
    assert.equal(envelope.evidenceLevel, "durable_verified");
  });
});
