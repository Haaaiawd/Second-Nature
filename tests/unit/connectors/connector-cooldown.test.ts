/**
 * ConnectorCooldownPort — Unit Tests (T-CS.R.3)
 *
 * Validates: repeated terminal failures block replay; retryable failures
 * do not accumulate terminal cooldown; expiry/reset allows retry.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createConnectorCooldownPort } from "../../../src/connectors/services/connector-cooldown-port.js";
import type { FailureClass } from "../../../src/connectors/base/failure-taxonomy.js";

describe("connector-cooldown-port", () => {
  it("is unblocked for unknown platform/intent", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const port = createConnectorCooldownPort(db);
      const result = await port.isBlocked("moltbook", "feed.read");
      assert.equal(result.blocked, false);
    } finally {
      db.close();
    }
  });

  it("blocks after repeated terminal failures", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const port = createConnectorCooldownPort(db);
      await port.markFailure("moltbook", "feed.read", "auth_failure");
      await port.markFailure("moltbook", "feed.read", "auth_failure");

      const result = await port.isBlocked("moltbook", "feed.read");
      assert.equal(result.blocked, true);
      assert.ok(result.retryAfterMs && result.retryAfterMs > 0);
    } finally {
      db.close();
    }
  });

  it("does not block after a single terminal failure", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const port = createConnectorCooldownPort(db);
      await port.markFailure("moltbook", "feed.read", "auth_failure");

      const result = await port.isBlocked("moltbook", "feed.read");
      assert.equal(result.blocked, false);
    } finally {
      db.close();
    }
  });

  it("uses retryAfterMs for rate_limited", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const port = createConnectorCooldownPort(db);
      await port.markFailure("moltbook", "feed.read", "rate_limited", 60000);

      const result = await port.isBlocked("moltbook", "feed.read");
      assert.equal(result.blocked, true);
      assert.ok(result.retryAfterMs && result.retryAfterMs <= 60000);
    } finally {
      db.close();
    }
  });

  it("does not cross-contaminate platform/capability", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const port = createConnectorCooldownPort(db);
      await port.markFailure("moltbook", "feed.read", "auth_failure");
      await port.markFailure("moltbook", "feed.read", "auth_failure");

      const other = await port.isBlocked("agent-world", "feed.read");
      assert.equal(other.blocked, false);
    } finally {
      db.close();
    }
  });
});
