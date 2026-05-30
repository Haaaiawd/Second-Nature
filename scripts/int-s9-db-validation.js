/**
 * INT-S9 DB before/after heartbeat validation script.
 *
 * Verifies: Given single heartbeat cycle (moltbook mock runner)
 *   / When feed.read completes
 *   / Then life_evidence_index has new row (DB before/after).
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { createStateDatabase } from "../dist/src/storage/db/index.js";
import { createObservabilityDatabase } from "../dist/src/observability/db/index.js";
import { createConnectorExecutorAdapter } from "../dist/src/connectors/services/connector-executor-adapter.js";
import { createCredentialVault } from "../dist/src/storage/services/credential-vault.js";
import { mapLifeEvidence } from "../dist/src/connectors/base/map-life-evidence.js";
import { appendLifeEvidence } from "../dist/src/storage/life-evidence/append-life-evidence.js";
import { lifeEvidenceIndex } from "../dist/src/storage/db/schema/life-evidence-index.js";

const ORIGINAL_KEY = process.env.SECOND_NATURE_ENCRYPTION_KEY;
const ORIGINAL_MOLTBOOK_URL = process.env.SECOND_NATURE_MOLTBOOK_BASE_URL;

process.env.SECOND_NATURE_ENCRYPTION_KEY = "x".repeat(32);
delete process.env.SECOND_NATURE_MOLTBOOK_BASE_URL;

function tempWorkspaceWithMock() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sn-int-s9-"));
  const mockDir = path.join(dir, ".second-nature", "mock");
  fs.mkdirSync(mockDir, { recursive: true });
  fs.writeFileSync(
    path.join(mockDir, "moltbook-feed.json"),
    JSON.stringify({
      items: [
        { id: "int-s9-1", title: "INT-S9 validation post 1", content: "Hello INT-S9" },
        { id: "int-s9-2", title: "INT-S9 validation post 2", content: "World INT-S9" },
      ],
    }),
    "utf-8",
  );
  return dir;
}

async function seedCredential(stateDb) {
  const vault = createCredentialVault(stateDb.db);
  await vault.saveCredentialContext({
    platformId: "moltbook",
    credentialType: "api_key",
    encryptedValue: "mock-token",
    status: "active",
  });
}

async function main() {
  const workspaceRoot = tempWorkspaceWithMock();
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");

  try {
    await seedCredential(stateDb);

    // BEFORE count
    const beforeRows = await stateDb.db.select().from(lifeEvidenceIndex);
    const beforeCount = beforeRows.length;
    console.log(`[INT-S9] BEFORE: life_evidence_index count = ${beforeCount}`);

    // Execute moltbook mock runner feed.read
    const executor = createConnectorExecutorAdapter({
      stateDb,
      observabilityDb,
      workspaceRoot,
    });

    const result = await executor.executeEffect({
      intent: "feed.read",
      platformId: "moltbook",
      payload: {},
      decisionId: "dec-int-s9",
      intentId: "intent-int-s9",
      idempotencyKey: "int-s9-feed-read",
    });

    if (result.status !== "success") {
      throw new Error(`Execution failed: ${JSON.stringify(result)}`);
    }
    console.log(`[INT-S9] Execution status: ${result.status}`);

    // Map to life evidence
    const candidate = mapLifeEvidence({
      platformId: "moltbook",
      intent: "feed.read",
      result,
      observedAt: new Date().toISOString(),
    });

    if (!candidate) {
      throw new Error("mapLifeEvidence returned null");
    }
    console.log(`[INT-S9] Evidence candidate: type=${candidate.evidenceType}, refs=${candidate.sourceRefs.length}`);

    // Append to DB
    const ack = await appendLifeEvidence(stateDb, workspaceRoot, candidate);
    console.log(`[INT-S9] Append ack: evidenceId=${ack.evidenceId}`);

    // AFTER count
    const afterRows = await stateDb.db.select().from(lifeEvidenceIndex);
    const afterCount = afterRows.length;
    console.log(`[INT-S9] AFTER: life_evidence_index count = ${afterCount}`);

    // Validate
    if (afterCount <= beforeCount) {
      throw new Error(`DB count did not increase: before=${beforeCount}, after=${afterCount}`);
    }

    const row = afterRows[0];
    console.log(`[INT-S9] New row: platformId=${row.platformId}, evidenceType=${row.evidenceType}, producer=${row.producer}`);
    console.log(`[INT-S9] ✅ VALIDATION PASSED`);

    return {
      beforeCount,
      afterCount,
      evidenceId: ack.evidenceId,
      row: {
        platformId: row.platformId,
        evidenceType: row.evidenceType,
        producer: row.producer,
        sourceRefsJson: row.sourceRefsJson,
      },
    };
  } finally {
    stateDb.close();
    observabilityDb.close();
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
    if (ORIGINAL_KEY === undefined) delete process.env.SECOND_NATURE_ENCRYPTION_KEY;
    else process.env.SECOND_NATURE_ENCRYPTION_KEY = ORIGINAL_KEY;
    if (ORIGINAL_MOLTBOOK_URL === undefined) delete process.env.SECOND_NATURE_MOLTBOOK_BASE_URL;
    else process.env.SECOND_NATURE_MOLTBOOK_BASE_URL = ORIGINAL_MOLTBOOK_URL;
  }
}

main()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error("[INT-S9] ❌ VALIDATION FAILED:", err.message);
    process.exit(1);
  });
