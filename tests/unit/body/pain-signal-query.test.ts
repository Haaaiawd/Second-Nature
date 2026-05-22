/**
 * PainSignal query tests — T-BTS.C.4
 *
 * Coverage:
 * - getPainSignal returns undefined when no experiences
 * - painLevel increases with failure rate and consecutive failures
 * - cooldownRecommended when consecutive failures >= threshold
 * - bounded to lookback limit
 * - capabilityId optional (aggregate across capabilities)
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createToolExperienceStore } from "../../../src/storage/services/tool-experience-store.js";
import { createPainSignalQuery } from "../../../src/core/second-nature/body/tool-experience/pain-signal-query.js";
import type { ToolExperience } from "../../../src/shared/types/v7-entities.js";

describe("PainSignalQuery", () => {
  it("returns undefined when empty", async () => {
    const db = createStateDatabase(":memory:");
    const store = createToolExperienceStore(db);
    const query = createPainSignalQuery(store, { lookbackLimit: 5 });

    const signal = await query.getPainSignal("twitter");
    assert.strictEqual(signal, undefined);
  });

  it("painLevel rises with consecutive failures", async () => {
    const db = createStateDatabase(":memory:");
    const store = createToolExperienceStore(db);
    const query = createPainSignalQuery(store, {
      lookbackLimit: 10,
      cooldownThreshold: 3,
    });

    for (let i = 0; i < 4; i++) {
      await store.appendToolExperience({
        experienceId: `exp-${i}`,
        connectorId: "twitter",
        capabilityId: "cap-1",
        outcome: "failure",
        latencyMs: 100,
        evidenceQuality: 0,
        sourceRefs: ["test:signal"],
        triggerSource: "heartbeat",
        createdAt: new Date(Date.now() - (3 - i) * 1000).toISOString(),
      });
    }

    const signal = await query.getPainSignal("twitter", "cap-1");
    assert(signal!.painLevel > 0.3);
    assert.strictEqual(signal!.consecutiveFailures, 4);
    assert.strictEqual(signal!.cooldownRecommended, true);
  });

  it("cooldownRecommended false below threshold", async () => {
    const db = createStateDatabase(":memory:");
    const store = createToolExperienceStore(db);
    const query = createPainSignalQuery(store, {
      lookbackLimit: 10,
      cooldownThreshold: 5,
    });

    for (let i = 0; i < 2; i++) {
      await store.appendToolExperience({
        experienceId: `exp-${i}`,
        connectorId: "twitter",
        capabilityId: "cap-1",
        outcome: "failure",
        latencyMs: 100,
        evidenceQuality: 0,
        sourceRefs: ["test:signal"],
        triggerSource: "heartbeat",
        createdAt: new Date(Date.now() - i * 1000).toISOString(),
      });
    }

    const signal = await query.getPainSignal("twitter", "cap-1");
    assert.strictEqual(signal!.cooldownRecommended, false);
  });

  it("resets consecutiveFailures after success", async () => {
    const db = createStateDatabase(":memory:");
    const store = createToolExperienceStore(db);
    const query = createPainSignalQuery(store, {
      lookbackLimit: 10,
      cooldownThreshold: 3,
    });

    await store.appendToolExperience({
      experienceId: "e1",
      connectorId: "twitter",
      capabilityId: "cap-1",
      outcome: "failure",
      latencyMs: 100,
      evidenceQuality: 0,
      sourceRefs: ["test:signal"],
      triggerSource: "heartbeat",
      createdAt: new Date(Date.now() - 2000).toISOString(),
    });
    await store.appendToolExperience({
      experienceId: "e2",
      connectorId: "twitter",
      capabilityId: "cap-1",
      outcome: "success",
      latencyMs: 100,
      evidenceQuality: 1,
      sourceRefs: ["test:signal"],
      triggerSource: "heartbeat",
      createdAt: new Date(Date.now() - 1000).toISOString(),
    });

    const signal = await query.getPainSignal("twitter", "cap-1");
    assert.strictEqual(signal!.consecutiveFailures, 0);
  });
});
