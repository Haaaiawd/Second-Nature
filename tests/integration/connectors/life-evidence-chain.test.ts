/**
 * T-CS.C.8 — Life Evidence end-to-end chain integration test.
 *
 * Verifies the full path:
 *   moltbook mock runner → policy layer → ConnectorResult
 *   → mapLifeEvidence → appendLifeEvidence
 *   → life_evidence_index DB row + artifact file
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createObservabilityDatabase } from "../../../src/observability/db/index.js";
import { createConnectorExecutorAdapter } from "../../../src/connectors/services/connector-executor-adapter.js";
import { createCredentialVault } from "../../../src/storage/services/credential-vault.js";
import { mapLifeEvidence } from "../../../src/connectors/base/map-life-evidence.js";
import { appendLifeEvidence } from "../../../src/storage/life-evidence/append-life-evidence.js";
import { lifeEvidenceIndex } from "../../../src/storage/db/schema/life-evidence-index.js";
import { eq } from "drizzle-orm";

const ORIGINAL_KEY = process.env.SECOND_NATURE_ENCRYPTION_KEY;
const ORIGINAL_MOLTBOOK_URL = process.env.SECOND_NATURE_MOLTBOOK_BASE_URL;

function tempWorkspaceWithMock(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sn-le-chain-"));
  const mockDir = path.join(dir, ".second-nature", "mock");
  fs.mkdirSync(mockDir, { recursive: true });
  fs.writeFileSync(
    path.join(mockDir, "moltbook-feed.json"),
    JSON.stringify({
      items: [
        { id: "chain-1", title: "Chain test item 1", content: "Hello chain" },
        { id: "chain-2", title: "Chain test item 2", content: "World chain" },
      ],
    }),
    "utf-8",
  );
  return dir;
}

async function seedCredential(stateDb: ReturnType<typeof createStateDatabase>) {
  const vault = createCredentialVault(stateDb.db);
  await vault.saveCredentialContext({
    platformId: "moltbook",
    credentialType: "api_key",
    encryptedValue: "mock-token",
    status: "active",
  });
}

test.beforeEach(() => {
  process.env.SECOND_NATURE_ENCRYPTION_KEY = "x".repeat(32);
  delete process.env.SECOND_NATURE_MOLTBOOK_BASE_URL;
});

test.afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.SECOND_NATURE_ENCRYPTION_KEY;
  else process.env.SECOND_NATURE_ENCRYPTION_KEY = ORIGINAL_KEY;
  if (ORIGINAL_MOLTBOOK_URL === undefined) delete process.env.SECOND_NATURE_MOLTBOOK_BASE_URL;
  else process.env.SECOND_NATURE_MOLTBOOK_BASE_URL = ORIGINAL_MOLTBOOK_URL;
});

test("T-CS.C.8-A: full chain produces life_evidence_index row and artifact", async () => {
  const workspaceRoot = tempWorkspaceWithMock();
  try {
    const stateDb = createStateDatabase(":memory:");
    const observabilityDb = createObservabilityDatabase(":memory:");
    await seedCredential(stateDb);

    // DB before count
    const beforeRows = await stateDb.db.select().from(lifeEvidenceIndex);
    assert.equal(beforeRows.length, 0, "DB must be empty before test");

    // 1. Execute through real executor + policy layer
    const executor = createConnectorExecutorAdapter({
      stateDb,
      observabilityDb,
      workspaceRoot,
    });

    const result = await executor.executeEffect({
      intent: "feed.read",
      platformId: "moltbook",
      payload: {},
      decisionId: "dec-chain-1",
      intentId: "intent-chain-1",
      idempotencyKey: "chain-feed-read-1",
    });

    assert.equal(result.status, "success", `execution should succeed: ${JSON.stringify(result)}`);
    assert.ok(result.data, "result must contain data");

    // 2. Map to life evidence candidate
    const candidate = mapLifeEvidence({
      platformId: "moltbook",
      intent: "feed.read",
      result,
      observedAt: new Date().toISOString(),
    });

    assert.ok(candidate, "mapLifeEvidence must return non-null candidate");
    assert.equal(candidate!.evidenceType, "platform_browse");
    assert.ok(candidate!.sourceRefs.length > 0, "candidate must have sourceRefs");

    // 3. Append to DB
    const ack = await appendLifeEvidence(stateDb, workspaceRoot, candidate!);
    assert.ok(ack.evidenceId, "ack must contain evidenceId");

    // 4. DB after count
    const afterRows = await stateDb.db.select().from(lifeEvidenceIndex);
    assert.equal(afterRows.length, 1, "DB must contain exactly 1 new evidence row");
    assert.equal(afterRows[0]!.platformId, "moltbook");
    assert.equal(afterRows[0]!.evidenceType, "platform_browse");
    assert.equal(afterRows[0]!.producer, "connector-system");
    assert.ok(afterRows[0]!.sourceRefsJson.includes("chain-1"), "sourceRefsJson must contain item ids");

    // 5. Artifact file exists
    const artifactPath = path.join(workspaceRoot, afterRows[0]!.artifactPath);
    assert.ok(fs.existsSync(artifactPath), "artifact file must exist on disk");
    const artifactContent = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
    assert.equal(artifactContent.platformId, "moltbook");
    assert.equal(artifactContent.evidenceType, "platform_browse");
    assert.ok(artifactContent.sourceRefs.length > 0);
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test("T-CS.C.8-B: policy-wrapped payload is penetrated by extractSourceRefs", async () => {
  const workspaceRoot = tempWorkspaceWithMock();
  try {
    const stateDb = createStateDatabase(":memory:");
    const observabilityDb = createObservabilityDatabase(":memory:");
    await seedCredential(stateDb);

    const executor = createConnectorExecutorAdapter({
      stateDb,
      observabilityDb,
      workspaceRoot,
    });

    const result = await executor.executeEffect({
      intent: "feed.read",
      platformId: "moltbook",
      payload: {},
      decisionId: "dec-chain-2",
      intentId: "intent-chain-2",
      idempotencyKey: "chain-feed-read-2",
    });

    assert.equal(result.status, "success");

    // Verify policy-layer wrapping: data should be {capability, channel, data: {source, items}}
    const payload = result.data as Record<string, unknown>;
    assert.equal(payload.capability, "feed.read", "policy layer wraps capability");
    assert.ok(payload.data && typeof payload.data === "object", "policy layer wraps nested data");

    // mapLifeEvidence must still extract refs through nested data
    const candidate = mapLifeEvidence({
      platformId: "moltbook",
      intent: "feed.read",
      result,
      observedAt: new Date().toISOString(),
    });

    assert.ok(candidate, "must extract refs through policy-wrapped nesting");
    assert.equal(candidate!.sourceRefs.length, 2, "must find both mock items");
    assert.equal(candidate!.sourceRefs[0]!.id, "chain-1");
    assert.equal(candidate!.sourceRefs[1]!.id, "chain-2");
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test("T-CS.C.8-C: feed.read returns platform_browse evidenceType candidate", async () => {
  const workspaceRoot = tempWorkspaceWithMock();
  try {
    const stateDb = createStateDatabase(":memory:");
    const observabilityDb = createObservabilityDatabase(":memory:");
    await seedCredential(stateDb);

    const executor = createConnectorExecutorAdapter({
      stateDb,
      observabilityDb,
      workspaceRoot,
    });

    const result = await executor.executeEffect({
      intent: "feed.read",
      platformId: "moltbook",
      payload: {},
      decisionId: "dec-chain-3",
      intentId: "intent-chain-3",
      idempotencyKey: "chain-feed-read-3",
    });

    const candidate = mapLifeEvidence({
      platformId: "moltbook",
      intent: "feed.read",
      result,
      observedAt: new Date().toISOString(),
    });

    assert.ok(candidate);
    assert.equal(candidate!.evidenceType, "platform_browse");
    assert.equal(candidate!.producer, "connector-system");
    assert.equal(candidate!.sensitivity, "public");
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
});
