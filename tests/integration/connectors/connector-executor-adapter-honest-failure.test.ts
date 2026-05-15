/**
 * Integration test: createConnectorExecutorAdapter honest failure paths.
 *
 * When credentials or base URLs are missing, the adapter returns terminal_failure
 * instead of throwing, keeping the heartbeat loop stable.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { createStateDatabase } from "../../../src/storage/index.js";
import { createObservabilityDatabase } from "../../../src/observability/index.js";
import { createConnectorExecutorAdapter } from "../../../src/connectors/services/connector-executor-adapter.js";

test("connector executor adapter returns terminal_failure when credential missing", async () => {
  const stateDb = createStateDatabase();
  const observabilityDb = createObservabilityDatabase();
  try {
    const adapter = createConnectorExecutorAdapter({
      stateDb,
      observabilityDb,
    });
    const result = await adapter.executeEffect({
      platformId: "moltbook",
      intent: "feed.read",
      payload: {},
      decisionId: "dec-test-1",
      intentId: "intent-test-1",
      idempotencyKey: "idem-test-1",
    });

    assert.equal(result.status, "terminal_failure");
    assert.ok(
      result.failureClass === "auth_failure",
      `Expected auth_failure, got: ${result.failureClass}`,
    );
    assert.equal(result.metadata.platformId, "moltbook");
  } finally {
    stateDb.close();
    observabilityDb.close();
  }
});

test("connector executor adapter returns terminal_failure for evomap (not yet implemented)", async () => {
  const stateDb = createStateDatabase();
  const observabilityDb = createObservabilityDatabase();
  try {
    const adapter = createConnectorExecutorAdapter({
      stateDb,
      observabilityDb,
    });
    const result = await adapter.executeEffect({
      platformId: "evomap",
      intent: "work.discover",
      payload: {},
      decisionId: "dec-test-2",
      intentId: "intent-test-2",
      idempotencyKey: "idem-test-2",
    });

    assert.equal(result.status, "terminal_failure");
    assert.ok(
      result.failureClass === "auth_failure" ||
        result.failureClass === "unknown_platform_change",
      `Expected auth_failure or unknown_platform_change, got: ${result.failureClass}`,
    );
    assert.equal(result.metadata.platformId, "evomap");
  } finally {
    stateDb.close();
    observabilityDb.close();
  }
});
