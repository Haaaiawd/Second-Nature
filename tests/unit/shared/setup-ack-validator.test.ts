import {
  describe,
  it,
} from "node:test";
import assert from "node:assert/strict";
import {
  validateSetupAck,
  isSetupAckComplete,
  SETUP_ACK_SCHEMA_VERSION,
} from "../../../src/shared/setup-ack.js";

describe("setup-ack validator", () => {
  const baseAck = {
    schemaVersion: SETUP_ACK_SCHEMA_VERSION,
    acknowledgedAt: new Date().toISOString(),
    placedIn: "workspace_guide",
    placementProofRef: "host://skill-registry/second-nature",
    writer: "setup_ack_command",
  };

  it("accepts a complete ack", () => {
    const result = validateSetupAck(baseAck);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.ack.placedIn, "workspace_guide");
    assert.equal(result.ack.placementProofRef, "host://skill-registry/second-nature");
  });

  it("rejects placedIn unspecified", () => {
    const result = validateSetupAck({ ...baseAck, placedIn: "unspecified" });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.errors.some((e) => e.field === "placedIn"));
  });

  it("rejects missing placedIn", () => {
    const { placedIn: _, ...missing } = baseAck;
    const result = validateSetupAck(missing);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.errors.some((e) => e.field === "placedIn"));
  });

  it("rejects unknown placement", () => {
    const result = validateSetupAck({ ...baseAck, placedIn: "somewhere_else" });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.errors.some((e) => e.field === "placedIn"));
  });

  it("rejects missing placementProofRef", () => {
    const { placementProofRef: _, ...missing } = baseAck;
    const result = validateSetupAck(missing);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.errors.some((e) => e.field === "placementProofRef"));
  });

  it("rejects empty placementProofRef", () => {
    const result = validateSetupAck({ ...baseAck, placementProofRef: "  " });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.errors.some((e) => e.field === "placementProofRef"));
  });

  it("rejects unauthorized writer", () => {
    const result = validateSetupAck({ ...baseAck, writer: "human_hand_edit" });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.errors.some((e) => e.field === "writer"));
  });

  it("rejects bad schemaVersion", () => {
    const result = validateSetupAck({ ...baseAck, schemaVersion: 2 });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.errors.some((e) => e.field === "schemaVersion"));
  });

  it("rejects bad timestamp", () => {
    const result = validateSetupAck({ ...baseAck, acknowledgedAt: "not-a-date" });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.errors.some((e) => e.field === "acknowledgedAt"));
  });

  it("isSetupAckComplete returns ack when valid", () => {
    const result = isSetupAckComplete(baseAck);
    assert.equal(result.complete, true);
    if (!result.complete) return;
    assert.equal(result.ack.placedIn, "workspace_guide");
  });

  it("isSetupAckComplete returns errors when invalid", () => {
    const result = isSetupAckComplete({ ...baseAck, placedIn: "unspecified" });
    assert.equal(result.complete, false);
    if (result.complete) return;
    assert.ok(result.errors.length > 0);
  });
});
