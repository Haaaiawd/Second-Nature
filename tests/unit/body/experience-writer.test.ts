/**
 * ExperienceWriter tests — T-BTS.C.4
 *
 * Coverage:
 * - recordExperience maps success → outcome "success"
 * - recordExperience maps terminal_failure → outcome "failure"
 * - failureClass transcribed from ConnectorResult (DR-007)
 * - triggerSource passed through (DR-010)
 * - gate rejects payload with raw secret
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createToolExperienceStore } from "../../../src/storage/services/tool-experience-store.js";
import { createExperienceWriter } from "../../../src/core/second-nature/body/tool-experience/experience-writer.js";
import type { ConnectorResult } from "../../../src/connectors/base/contract.js";

describe("ExperienceWriter", () => {
  it("records success with outcome success", async () => {
    const db = createStateDatabase(":memory:");
    const store = createToolExperienceStore(db);
    const writer = createExperienceWriter(store);

    const result: ConnectorResult<unknown> = {
      status: "success",
      metadata: { platformId: "twitter", channel: "api_rest", latencyMs: 120 },
    };

    await writer.recordExperience({
      connectorId: "twitter",
      capabilityId: "cap-1",
      result,
      triggerSource: "heartbeat",
    });

    const rows = await store.listToolExperience({ connectorId: "twitter" });
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0]!.outcome, "success");
    assert.strictEqual(rows[0]!.triggerSource, "heartbeat");
    assert.strictEqual(rows[0]!.latencyMs, 120);
  });

  it("records terminal_failure with outcome failure and failureClass", async () => {
    const db = createStateDatabase(":memory:");
    const store = createToolExperienceStore(db);
    const writer = createExperienceWriter(store);

    const result: ConnectorResult<unknown> = {
      status: "terminal_failure",
      failureClass: "auth_failure",
      metadata: { platformId: "twitter", channel: "api_rest", latencyMs: 50 },
    };

    await writer.recordExperience({
      connectorId: "twitter",
      capabilityId: "cap-1",
      result,
      triggerSource: "manual_run",
    });

    const rows = await store.listToolExperience({ connectorId: "twitter" });
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0]!.outcome, "failure");
    assert.strictEqual(rows[0]!.failureClass, "auth_failure");
    assert.strictEqual(rows[0]!.triggerSource, "manual_run");
  });

  it("gate rejects if payload contains raw secret", async () => {
    const db = createStateDatabase(":memory:");
    const store = createToolExperienceStore(db);
    const writer = createExperienceWriter(store);

    const result: ConnectorResult<unknown> = {
      status: "success",
      metadata: {
        platformId: "twitter",
        channel: "api_rest",
        latencyMs: 120,
      },
    };

    await assert.rejects(
      writer.recordExperience({
        connectorId: "twitter",
        capabilityId: "sk-abcdefghijklmnopqrstuvwxyz123456789",
        result,
        triggerSource: "heartbeat",
      }),
      /write_validation_failed/,
    );
  });
});
