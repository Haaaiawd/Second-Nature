/**
 * ConnectorCooldownPort — API Tests (T-CS.R.3)
 *
 * Validates: cooldown state is durable and observable through state read ports,
 * and blocks route planning after repeated terminal failures.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createConnectorCooldownPort } from "../../../src/connectors/services/connector-cooldown-port.js";
import { readConnectorCooldownState } from "../../../src/storage/v8-state-stores.js";

describe("connector-cooldown-port API", () => {
  it("persists cooldown row after markFailure", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const port = createConnectorCooldownPort(db);
      await port.markFailure("moltbook", "feed.read", "auth_failure");

      const row = await readConnectorCooldownState(db, "moltbook", "feed.read");
      assert.ok(row.row);
      assert.equal(row.row?.platformId, "moltbook");
      assert.equal(row.row?.capabilityId, "feed.read");
      assert.equal(row.row?.failureClass, "auth_failure");
      assert.equal(row.row?.failureCount, 1);
    } finally {
      db.close();
    }
  });

  it("increments failure count for repeated failures", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const port = createConnectorCooldownPort(db);
      await port.markFailure("moltbook", "feed.read", "auth_failure");
      await port.markFailure("moltbook", "feed.read", "auth_failure");
      await port.markFailure("moltbook", "feed.read", "auth_failure");

      const row = await readConnectorCooldownState(db, "moltbook", "feed.read");
      assert.equal(row.row?.failureCount, 3);
    } finally {
      db.close();
    }
  });

  it("exposes retryAfterMs on active cooldown", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const port = createConnectorCooldownPort(db);
      await port.markFailure("moltbook", "feed.read", "auth_failure");
      await port.markFailure("moltbook", "feed.read", "auth_failure");

      const blocked = await port.isBlocked("moltbook", "feed.read");
      assert.equal(blocked.blocked, true);
      assert.ok(typeof blocked.retryAfterMs === "number");
    } finally {
      db.close();
    }
  });
});
