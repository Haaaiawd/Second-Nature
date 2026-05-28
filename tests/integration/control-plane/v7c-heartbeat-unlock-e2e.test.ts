/**
 * Wave 82 — Heartbeat Unlock E2E
 *
 * Verifies the complete chain after W80+W81 fixes:
 *   planCandidateIntents (goal sourceRefs)
 *   → evaluateHardGuards (allow, no missing_source_refs / affordance_unavailable)
 *   → connectorExecutor (moltbook mock runner success)
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createObservabilityDatabase } from "../../../src/observability/db/index.js";
import { planCandidateIntents } from "../../../src/core/second-nature/orchestrator/intent-planner.js";
import { evaluateHardGuards } from "../../../src/core/second-nature/orchestrator/hard-guard-evaluator.js";
import { createConnectorExecutorAdapter } from "../../../src/connectors/services/connector-executor-adapter.js";
import { createCredentialVault } from "../../../src/storage/services/credential-vault.js";
import { buildHeartbeatRuntimeSnapshot } from "../../../src/core/second-nature/heartbeat/runtime-snapshot.js";
import { buildContinuitySnapshot } from "../../../src/core/second-nature/heartbeat/snapshot-builder.js";
import type { SnapshotInputs } from "../../../src/core/second-nature/heartbeat/snapshot-builder.js";
import { CapabilityContractRegistryV7 } from "../../../src/connectors/base/manifest-v7.js";
import { createAffordanceAssembler } from "../../../src/core/second-nature/body/tool-affordance/affordance-assembler.js";

const ORIGINAL_KEY = process.env.SECOND_NATURE_ENCRYPTION_KEY;
const ORIGINAL_MOLTBOOK_URL = process.env.SECOND_NATURE_MOLTBOOK_BASE_URL;

function tempWorkspaceWithMock(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sn-e2e-test-"));
  const mockDir = path.join(dir, ".second-nature", "mock");
  fs.mkdirSync(mockDir, { recursive: true });
  fs.writeFileSync(
    path.join(mockDir, "moltbook-feed.json"),
    JSON.stringify({ items: [{ id: "e2e-1", title: "E2E mock item" }] }),
    "utf-8",
  );
  return dir;
}

function makeRuntime(ts: string) {
  const inputs: SnapshotInputs = {
    mode: "active",
    currentWindowId: "win_work_morning",
    pendingObligations: [],
    recentOutreachHashes: [],
    deniedIntents: [],
    lifeEvidenceRefs: [],
    platformEventCount: 0,
    workEventCount: 0,
    duplicateIntentKeys: [],
    outreachCooldownKeys: [],
  };
  const continuity = buildContinuitySnapshot(inputs);
  return buildHeartbeatRuntimeSnapshot(ts, inputs, continuity);
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

test("W82: full chain intent → guard allow → mock execution success", async () => {
  const workspaceRoot = tempWorkspaceWithMock();
  try {
    const stateDb = createStateDatabase(":memory:");
    const observabilityDb = createObservabilityDatabase(":memory:");
    const vault = createCredentialVault(stateDb.db);
    await vault.saveCredentialContext({
      platformId: "moltbook",
      credentialType: "api_key",
      encryptedValue: "mock-token",
      status: "active",
    });

    // Step 1: planCandidateIntents with accepted goal → non-empty sourceRefs
    const runtime = makeRuntime("2026-05-27T10:00:00Z");
    const candidates = planCandidateIntents(runtime, {
      acceptedGoals: [
        {
          goalId: "goal-explore-moltbook",
          description: "Explore MoltBook integration opportunities",
          status: "accepted",
          origin: "owner_set",
        },
      ],
    });

    const exploration = candidates.find((c) => c.kind === "exploration" && c.platformId === "moltbook");
    assert.ok(exploration, "must plan exploration intent for moltbook");
    assert.ok(exploration!.sourceRefs.length > 0, "exploration must have sourceRefs from goal fallback");

    // Step 2: assemble affordance map with needs_auth posture
    const registry = new CapabilityContractRegistryV7();
    registry.register({
      platformId: "moltbook",
      capabilities: [
        { capabilityId: "feed.read", intent: "feed.read", probeConfig: { safeEndpoint: "connector://moltbook/feed.read", idempotencyClass: "read_only" } },
      ],
      channelPriority: ["api_rest"],
      credentialTypes: ["api_key"],
    });
    const affordanceAssembler = createAffordanceAssembler({
      registry,
      probeReader: { getLatestProbeResult: () => undefined },
      credentialRequired: (platformId) => ["moltbook", "evomap", "agent-world", "instreet"].includes(platformId),
    });
    const affordanceMap = await affordanceAssembler.assembleAffordanceMap({
      allowedStatuses: ["safe", "exploratory", "needs_auth"],
    });

    // Step 3: evaluateHardGuards → allow (no missing_source_refs, no affordance_unavailable)
    const guardResult = evaluateHardGuards(exploration!, {
      hasDuplicateIntent: () => false,
      isOutreachCooldownClear: () => true,
      affordanceMap,
    });
    assert.equal(guardResult.verdict, "allow", `guard should allow, got reasons: ${guardResult.reasons.join(", ")}`);

    // Step 4: connectorExecutor → mock success
    const executor = createConnectorExecutorAdapter({
      stateDb,
      observabilityDb,
      workspaceRoot,
    });
    const execResult = await executor.executeEffect({
      intent: "feed.read",
      platformId: "moltbook",
      payload: {},
      decisionId: "dec-e2e-1",
      intentId: exploration!.id,
      idempotencyKey: exploration!.idempotencyKey ?? "e2e-fallback-key",
    });
    assert.equal(execResult.status, "success", `execution should succeed: ${JSON.stringify(execResult)}`);
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
});
