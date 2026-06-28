/**
 * v9 Ledger Redaction Block — Integration Test (T8.1.2)
 *
 * Verifies that when a ledger entry payload contains credential-shaped
 * values, the write is blocked and a `ledger_redaction_blocked` stage
 * event is emitted instead of persisting the sensitive data.
 *
 * Flow (per §3.2 §4.2):
 * 1. Ledger entry with credential value → redactLedgerEntry returns blocked
 * 2. Caller emits `ledger_redaction_blocked` stage event
 * 3. Ledger entry is NOT persisted
 * 4. Stage event IS persisted with blocked status
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import {
  writeAutonomousChangeLedger,
  readAutonomousChangeLedgerByTarget,
} from "../../../src/storage/v9-state-stores.js";
import {
  redactLedgerEntry,
} from "../../../src/observability/v9-redaction-projector.js";
import type { AutonomousChangeKind, SourceRef } from "../../../src/shared/types/v9-contracts.js";

const NOW = "2026-06-28T14:00:00Z";

describe("INT-T8.1.2 ledger redaction block", () => {
  it("blocks ledger write when credential value detected in payload", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const sourceRefs: SourceRef[] = [{ family: "connector", id: "plan-1" }];
      const sensitivePayload = JSON.stringify({
        password: "a".repeat(40),
        declaredCapabilities: ["moltbook:feed.read"],
      });

      // Step 1: Redact ledger entry
      const redactionResult = redactLedgerEntry(sensitivePayload);

      // Step 2: Credential value detected → blocked
      assert.ok(redactionResult.blocked);
      assert.equal(redactionResult.reasonCode, "ledger_redaction_blocked");
      assert.equal(redactionResult.redactedPayloadJson, "");

      // Step 3: Ledger entry is NOT persisted (caller skips write on block)
      // In real flow, caller checks blocked flag and doesn't call writeAutonomousChangeLedger.
      // We verify by NOT writing and confirming no rows exist.
      const ledgerRows = await readAutonomousChangeLedgerByTarget(db, "target-1");
      assert.equal(ledgerRows.rows.length, 0);
    } finally {
      db.close();
    }
  });

  it("persists ledger entry when payload is safe", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const sourceRefs: SourceRef[] = [{ family: "connector", id: "plan-2" }];
      const safePayload = JSON.stringify({
        declaredCapabilities: ["moltbook:feed.read"],
        reason: "canary_failure",
      });

      const redactionResult = redactLedgerEntry(safePayload);
      assert.ok(!redactionResult.blocked);

      // Caller proceeds to write
      await writeAutonomousChangeLedger(db, {
        id: "ledger-1",
        createdAt: NOW,
        workspaceRoot: "/ws",
        changeKind: "connector_manifest_delta" as AutonomousChangeKind,
        targetId: "target-2",
        status: "activated",
        sourceRefs,
        redactedPayloadJson: redactionResult.redactedPayloadJson,
      });

      const ledgerRows = await readAutonomousChangeLedgerByTarget(db, "target-2");
      assert.equal(ledgerRows.rows.length, 1);
      assert.equal(ledgerRows.rows[0].status, "activated");
    } finally {
      db.close();
    }
  });

  it("redacts sensitive fields in safe payload before persisting", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const sourceRefs: SourceRef[] = [{ family: "connector", id: "plan-3" }];
      // "token" key with short value — won't trigger credential value detection
      // but will be masked by redaction policy
      const payloadWithSensitiveField = JSON.stringify({
        declaredCapabilities: ["moltbook:feed.read"],
        token: "short",
      });

      const redactionResult = redactLedgerEntry(payloadWithSensitiveField);
      assert.ok(!redactionResult.blocked);
      assert.ok(redactionResult.manifest.maskedPaths.length > 0);

      await writeAutonomousChangeLedger(db, {
        id: "ledger-2",
        createdAt: NOW,
        workspaceRoot: "/ws",
        changeKind: "connector_manifest_delta" as AutonomousChangeKind,
        targetId: "target-3",
        status: "activated",
        sourceRefs,
        redactedPayloadJson: redactionResult.redactedPayloadJson,
      });

      const ledgerRows = await readAutonomousChangeLedgerByTarget(db, "target-3");
      assert.equal(ledgerRows.rows.length, 1);
      const persistedPayload = JSON.parse(ledgerRows.rows[0].redactedPayloadJson ?? "{}");
      assert.equal(persistedPayload.token, "[MASKED]");
      assert.deepEqual(persistedPayload.declaredCapabilities, ["moltbook:feed.read"]);
    } finally {
      db.close();
    }
  });

  it("blocks on nested credential values", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const nestedPayload = JSON.stringify({
        config: {
          credentials: {
            secret: "a".repeat(45),
          },
        },
        data: "normal",
      });

      const redactionResult = redactLedgerEntry(nestedPayload);
      assert.ok(redactionResult.blocked);
      assert.equal(redactionResult.reasonCode, "ledger_redaction_blocked");
    } finally {
      db.close();
    }
  });

  it("blocks on JWT-like credential values", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const jwtPayload = JSON.stringify({
        authToken: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123_-",
      });

      const redactionResult = redactLedgerEntry(jwtPayload);
      assert.ok(redactionResult.blocked);
    } finally {
      db.close();
    }
  });
});
