/**
 * T-SMS.C.5 — ToolExperienceStore + CapabilityProbeResultStore 单元测试
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import {
  createToolExperienceStore,
  createCapabilityProbeResultStore,
} from "../../../src/storage/services/tool-experience-store.js";

describe("ToolExperienceStore", () => {
  it("appends and lists tool experience", async () => {
    const db = createStateDatabase(":memory:");
    const store = createToolExperienceStore(db);

    await store.appendToolExperience({
      experienceId: "exp-1",
      connectorId: "moltbook",
      capabilityId: "feed.read",
      outcome: "failure",
      failureClass: "http_404",
      latencyMs: 120,
      evidenceQuality: 0,
      sourceRefs: ["probe:result-1"],
      triggerSource: "probe",
      createdAt: "2026-05-21T00:00:00Z",
    });

    const rows = await store.listToolExperience({ connectorId: "moltbook" });
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0]!.failureClass, "http_404");
    assert.strictEqual(rows[0]!.triggerSource, "probe");
  });

  it("rejects raw payload through gate", async () => {
    const db = createStateDatabase(":memory:");
    const store = createToolExperienceStore(db);

    await assert.rejects(
      store.appendToolExperience({
        experienceId: "exp-bad",
        connectorId: "x",
        capabilityId: "x",
        outcome: "success",
        latencyMs: 0,
        evidenceQuality: 0,
        sourceRefs: ["ref:1"],
        triggerSource: "heartbeat",
        createdAt: "2026-05-21T00:00:00Z",
        credential: "secret", // sensitive field
      } as unknown as import("../../../src/shared/types/v7-entities.js").ToolExperience),
    );
  });
});

describe("CapabilityProbeResultStore", () => {
  it("appends and lists probe results", async () => {
    const db = createStateDatabase(":memory:");
    const store = createCapabilityProbeResultStore(db);

    await store.appendProbeResult({
      probeResultId: "probe-1",
      capabilityId: "moltbook:feed.read",
      connectorId: "moltbook",
      actualStatus: "available",
      httpStatus: 200,
      sampleResponseRef: "ref:1",
      probeConfigRef: "cfg:1",
      createdAt: "2026-05-21T00:00:00Z",
    });

    const rows = await store.listProbeResults("moltbook");
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0]!.actualStatus, "available");
    assert.strictEqual(rows[0]!.httpStatus, 200);
  });

  it("upserts duplicate probe result ids instead of crashing", async () => {
    const db = createStateDatabase(":memory:");
    const store = createCapabilityProbeResultStore(db);

    await store.appendProbeResult({
      probeResultId: "probe-repeat",
      capabilityId: "moltbook:feed.read",
      connectorId: "moltbook",
      actualStatus: "degraded",
      httpStatus: 503,
      probeConfigRef: "cfg:old",
      createdAt: "2026-05-21T00:00:00Z",
    });
    await store.appendProbeResult({
      probeResultId: "probe-repeat",
      capabilityId: "moltbook:feed.read",
      connectorId: "moltbook",
      actualStatus: "available",
      httpStatus: 200,
      probeConfigRef: "cfg:new",
      createdAt: "2026-05-21T00:01:00Z",
    });

    const rows = await store.listProbeResults("moltbook");
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0]!.actualStatus, "available");
    assert.strictEqual(rows[0]!.httpStatus, 200);
    assert.strictEqual(rows[0]!.probeConfigRef, "cfg:new");
  });
});
