/**
 * T-CS.C.12 — Scriptable Runner end-to-end integration test.
 *
 * Verifies the full path:
 *   workspace manifest (scriptable_node) → scanner/registry recognition
 *   → executor loads runner.mjs → ConnectorResult success
 *   → mapLifeEvidence extracts sourceRefs → appendLifeEvidence writes DB + artifact
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
import { scanConnectorManifests } from "../../../src/connectors/registry/manifest-scanner.js";
import { parseConnectorManifestV6 } from "../../../src/connectors/manifest/manifest-parser.js";

const ORIGINAL_KEY = process.env.SECOND_NATURE_ENCRYPTION_KEY;

function tempWorkspaceWithScriptableRunner(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sn-scriptable-e2e-"));
  const connectorDir = path.join(dir, ".second-nature", "connectors", "scriptable-social");
  fs.mkdirSync(connectorDir, { recursive: true });

  fs.writeFileSync(
    path.join(connectorDir, "manifest.yaml"),
    `schemaVersion: "sn.connector.v1"
platformId: "scriptable-social"
displayName: "Scriptable Social"
family: "custom"
capabilities:
  - id: "feed.read"
    description: "Read feed via scriptable runner"
runner:
  kind: "scriptable_node"
  entrypoint: "runner.mjs"
credentials:
  - type: "api_key"
    required: false
sourceRefPolicy:
  minSourceRefs: 1
  rejectInlineSensitivePayload: true
trust:
  status: "declarative_trusted"
  reason: "test_fixture"
`,
    "utf-8",
  );

  fs.writeFileSync(
    path.join(connectorDir, "runner.mjs"),
    `export default async function handler(input) {
  return {
    success: true,
    data: {
      posts: [
        { id: "sc-1", title: "Scriptable post 1", url: "https://example.com/1" },
        { id: "sc-2", title: "Scriptable post 2", url: "https://example.com/2" },
      ],
    },
  };
}
`,
    "utf-8",
  );

  return dir;
}

test.beforeEach(() => {
  process.env.SECOND_NATURE_ENCRYPTION_KEY = "x".repeat(32);
});

test.afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.SECOND_NATURE_ENCRYPTION_KEY;
  else process.env.SECOND_NATURE_ENCRYPTION_KEY = ORIGINAL_KEY;
});

test("T-CS.C.12-A: scanner recognizes scriptable_node manifest", async () => {
  const workspaceRoot = tempWorkspaceWithScriptableRunner();
  try {
    const scanned = scanConnectorManifests(workspaceRoot);
    assert.equal(scanned.length, 1, "scanner must find exactly 1 manifest");

    const parsed = parseConnectorManifestV6(scanned[0]!.content);
    assert.equal(parsed.ok, true, `manifest parse failed: ${JSON.stringify(parsed)}`);
    const manifest = (parsed as { ok: true; manifest: { platformId: string; runner: { kind: string; entrypoint?: string } } }).manifest;
    assert.equal(manifest.platformId, "scriptable-social");
    assert.equal(manifest.runner.kind, "scriptable_node");
    assert.equal(manifest.runner.entrypoint, "runner.mjs");
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test("T-CS.C.12-B: executor loads runner.mjs and returns success", async () => {
  const workspaceRoot = tempWorkspaceWithScriptableRunner();
  try {
    const stateDb = createStateDatabase(":memory:");
    const observabilityDb = createObservabilityDatabase(":memory:");

    const executor = createConnectorExecutorAdapter({
      stateDb,
      observabilityDb,
      workspaceRoot,
    });

    const result = await executor.executeEffect({
      intent: "feed.read",
      platformId: "scriptable-social",
      payload: {},
      decisionId: "dec-sc-1",
      intentId: "intent-sc-1",
      idempotencyKey: "sc-feed-1",
    });

    assert.equal(result.status, "success", `expected success, got ${JSON.stringify(result)}`);
    assert.ok(result.data, "result must contain data");
    const payload = result.data as Record<string, unknown>;
    const data = payload.data as Record<string, unknown>;
    const posts = data.posts as Array<Record<string, unknown>>;
    assert.equal(posts.length, 2);
    assert.equal(posts[0]!.id, "sc-1");
    assert.equal(posts[1]!.id, "sc-2");
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test("T-CS.C.12-C: mapLifeEvidence extracts sourceRefs from scriptable_node result", async () => {
  const workspaceRoot = tempWorkspaceWithScriptableRunner();
  try {
    const stateDb = createStateDatabase(":memory:");
    const observabilityDb = createObservabilityDatabase(":memory:");

    const executor = createConnectorExecutorAdapter({
      stateDb,
      observabilityDb,
      workspaceRoot,
    });

    const result = await executor.executeEffect({
      intent: "feed.read",
      platformId: "scriptable-social",
      payload: {},
      decisionId: "dec-sc-2",
      intentId: "intent-sc-2",
      idempotencyKey: "sc-feed-2",
    });

    assert.equal(result.status, "success");

    const candidate = mapLifeEvidence({
      platformId: "scriptable-social",
      intent: "feed.read",
      result,
      observedAt: new Date().toISOString(),
    });

    assert.ok(candidate, "mapLifeEvidence must return candidate");
    assert.equal(candidate!.evidenceType, "platform_browse");
    assert.equal(candidate!.producer, "connector-system");
    assert.equal(candidate!.sensitivity, "public");
    assert.equal(candidate!.sourceRefs.length, 2);
    assert.equal(candidate!.sourceRefs[0]!.id, "sc-1");
    assert.equal(candidate!.sourceRefs[0]!.uri, "https://example.com/1");
    assert.equal(candidate!.sourceRefs[1]!.id, "sc-2");
    assert.equal(candidate!.sourceRefs[1]!.uri, "https://example.com/2");
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test("T-CS.C.12-D: full chain writes life_evidence_index row and artifact", async () => {
  const workspaceRoot = tempWorkspaceWithScriptableRunner();
  try {
    const stateDb = createStateDatabase(":memory:");
    const observabilityDb = createObservabilityDatabase(":memory:");

    const beforeRows = await stateDb.db.select().from(lifeEvidenceIndex);
    assert.equal(beforeRows.length, 0, "DB must be empty before test");

    const executor = createConnectorExecutorAdapter({
      stateDb,
      observabilityDb,
      workspaceRoot,
    });

    const result = await executor.executeEffect({
      intent: "feed.read",
      platformId: "scriptable-social",
      payload: {},
      decisionId: "dec-sc-3",
      intentId: "intent-sc-3",
      idempotencyKey: "sc-feed-3",
    });

    assert.equal(result.status, "success");

    const candidate = mapLifeEvidence({
      platformId: "scriptable-social",
      intent: "feed.read",
      result,
      observedAt: new Date().toISOString(),
    });

    assert.ok(candidate);
    const ack = await appendLifeEvidence(stateDb, workspaceRoot, candidate!);
    assert.ok(ack.evidenceId, "ack must contain evidenceId");

    const afterRows = await stateDb.db.select().from(lifeEvidenceIndex);
    assert.equal(afterRows.length, 1, "DB must contain exactly 1 new evidence row");
    assert.equal(afterRows[0]!.platformId, "scriptable-social");
    assert.equal(afterRows[0]!.evidenceType, "platform_browse");
    assert.equal(afterRows[0]!.producer, "connector-system");
    assert.ok(afterRows[0]!.sourceRefsJson.includes("sc-1"), "sourceRefsJson must contain sc-1");
    assert.ok(afterRows[0]!.sourceRefsJson.includes("sc-2"), "sourceRefsJson must contain sc-2");

    const artifactPath = path.join(workspaceRoot, afterRows[0]!.artifactPath);
    assert.ok(fs.existsSync(artifactPath), "artifact file must exist on disk");
    const artifactContent = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
    assert.equal(artifactContent.platformId, "scriptable-social");
    assert.equal(artifactContent.evidenceType, "platform_browse");
    assert.equal(artifactContent.sourceRefs.length, 2);
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test("T-CS.C.12-E: optional credential (required:false) does not block execution when vault empty", async () => {
  const workspaceRoot = tempWorkspaceWithScriptableRunner();
  // Intentionally do NOT seed credential
  try {
    const stateDb = createStateDatabase(":memory:");
    const observabilityDb = createObservabilityDatabase(":memory:");

    const executor = createConnectorExecutorAdapter({
      stateDb,
      observabilityDb,
      workspaceRoot,
    });

    const result = await executor.executeEffect({
      intent: "feed.read",
      platformId: "scriptable-social",
      payload: {},
      decisionId: "dec-sc-opt",
      intentId: "intent-sc-opt",
      idempotencyKey: "sc-opt-1",
    });

    assert.equal(result.status, "success", `expected success without credential, got ${JSON.stringify(result)}`);
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
});
