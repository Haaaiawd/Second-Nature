/**
 * T-OBS.F.1 — Audit family registry unit tests.
 *
 * Verification (05A / 05B):
 * - 8 system families registered and loadable
 * - Unknown family rejection returns `unknown_audit_family`
 * - All 8 v7 system IDs covered
 *
 * Dependencies: src/observability/audit/family-registry.ts,
 *               src/observability/audit/audit-family-registry.json
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createAuditFamilyRegistry,
  type AuditFamilyEntry,
} from "../../../src/observability/audit/family-registry.js";

import registryJson from "../../../src/observability/audit/audit-family-registry.json" with { type: "json" };

const EXPECTED_SYSTEM_IDS = [
  "body-tool-system",
  "connector-system",
  "control-plane-system",
  "dream-quiet-system",
  "guidance-voice-system",
  "observability-health-system",
  "runtime-ops-system",
  "state-memory-system",
];

const EXPECTED_FAMILIES = [
  "heartbeat.decision",
  "delivery",
  "source_coverage",
  "guidance.grounding",
  "host_capability",
  "connector.attempt",
  "state.governance",
  "narrative.trace",
  "dream.trace",
  "body.tool_experience",
];

describe("audit-family-registry", () => {
  it("loads all families from JSON registry", () => {
    const entries = registryJson.families as AuditFamilyEntry[];
    const registry = createAuditFamilyRegistry(entries);

    assert.ok(registry.size >= 10, `Expected >= 10 families, got ${registry.size}`);
  });

  it("all expected families are registered", () => {
    const entries = registryJson.families as AuditFamilyEntry[];
    const registry = createAuditFamilyRegistry(entries);

    for (const family of EXPECTED_FAMILIES) {
      assert.ok(
        registry.isRegistered(family),
        `Expected family '${family}' to be registered`
      );
    }
  });

  it("covers all 8 v7 system IDs", () => {
    const entries = registryJson.families as AuditFamilyEntry[];
    const registry = createAuditFamilyRegistry(entries);

    const systemIds = registry.listSystemIds();
    for (const id of EXPECTED_SYSTEM_IDS) {
      assert.ok(
        systemIds.includes(id),
        `Expected system ID '${id}' to be covered`
      );
    }
    assert.equal(systemIds.length, 8, "Expected exactly 8 system IDs");
  });

  it("rejects unknown family with unknown_audit_family error", () => {
    const entries = registryJson.families as AuditFamilyEntry[];
    const registry = createAuditFamilyRegistry(entries);

    const result = registry.validateFamily("totally.made.up.family");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(
        result.error.startsWith("unknown_audit_family"),
        `Expected error starting with 'unknown_audit_family', got: ${result.error}`
      );
    }
  });

  it("accepts registered family", () => {
    const entries = registryJson.families as AuditFamilyEntry[];
    const registry = createAuditFamilyRegistry(entries);

    const result = registry.validateFamily("heartbeat.decision");
    assert.equal(result.ok, true);
  });

  it("getEntry returns correct entry for registered family", () => {
    const entries = registryJson.families as AuditFamilyEntry[];
    const registry = createAuditFamilyRegistry(entries);

    const entry = registry.getEntry("connector.attempt");
    assert.ok(entry);
    assert.equal(entry.systemId, "connector-system");
    assert.equal(entry.plane, "telemetry");
  });

  it("getEntry returns undefined for unknown family", () => {
    const entries = registryJson.families as AuditFamilyEntry[];
    const registry = createAuditFamilyRegistry(entries);

    const entry = registry.getEntry("nope.not.here");
    assert.equal(entry, undefined);
  });

  it("familiesForSystem returns correct families", () => {
    const entries = registryJson.families as AuditFamilyEntry[];
    const registry = createAuditFamilyRegistry(entries);

    const guidanceFamilies = registry.familiesForSystem("guidance-voice-system");
    assert.ok(guidanceFamilies.length >= 2);
    const familyNames = guidanceFamilies.map((f) => f.family);
    assert.ok(familyNames.includes("delivery"));
    assert.ok(familyNames.includes("guidance.grounding"));
  });

  it("each registered family has a non-empty description", () => {
    const entries = registryJson.families as AuditFamilyEntry[];
    const registry = createAuditFamilyRegistry(entries);

    for (const entry of registry.listFamilies()) {
      assert.ok(
        entry.description.length > 0,
        `Family '${entry.family}' has empty description`
      );
    }
  });
});
