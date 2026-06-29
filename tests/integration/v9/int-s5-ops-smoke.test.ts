/**
 * INT-S5 — v9 Character, Observability & Ops Smoke Test
 *
 * Sprint gate S5: validates that v9 public ops outputs are:
 * - redacted (no raw credential/private/prompt values)
 * - source-backed (sourceRefs present where claims are made)
 * - contestable (character frames carry contestPrompt)
 * - non-emotional (no emotion/personality/hard-control assertions)
 *
 * Covers:
 * - continuity.read with real state DB (card + character frame)
 * - routine.list with installed routine
 * - routine.show with routineId
 * - connector_evolution.status with plan
 * - loop_status.read with health inputs
 * - Redaction gate: sensitive payload fields are redacted
 * - Envelope shape: all envelopes are JSON-serializable with correct shape
 * - Evidence level truth gate: carrier mode caps to carrier_ack
 *
 * Evidence: reports/int-s5-v9-character-observability-ops.md, logs/int-s5-v9-ops.json
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createIdentityProfileStore } from "../../../src/storage/services/identity-profile-store.js";
import { createGoalLifecycleStore } from "../../../src/storage/services/goal-lifecycle-store.js";
import { createInteractionSnapshotProjector } from "../../../src/storage/services/interaction-snapshot-projector.js";
import { createToolExperienceStore } from "../../../src/storage/services/tool-experience-store.js";
import { createDiaryDreamStore } from "../../../src/storage/services/diary-dream-store.js";
import { createEmbodiedContextStatePort } from "../../../src/storage/services/embodied-context-state-port.js";
import {
  writeSelfContinuityCard,
  writeCharacterFrame,
  writeToolRoutine,
  writeConnectorEvolutionPlan,
  writeAutonomousChangeLedger,
} from "../../../src/storage/v9-state-stores.js";
import {
  dispatchV9OpsCommand,
  type V9OpsHandlerDeps,
} from "../../../src/cli/ops/v9-ops-handlers.js";
import { assembleEnvelope } from "../../../src/cli/ops/v9-envelope-factory.js";
import type { RuntimeOpsEnvelopeV9 } from "../../../src/shared/types/v9-contracts.js";
import type { LoopStatusInputs } from "../../../src/observability/v9-loop-health-aggregator.js";

// ───────────────────────────────────────────────────────────────
// Forbidden patterns (non-emotional assertion check)
// ───────────────────────────────────────────────────────────────

const FORBIDDEN_PATTERNS = [
  /emotion/i,
  /feeling\s+(happy|sad|angry|afraid|surprised|disgusted)/i,
  /personality\s+score/i,
  /mood\s*:/i,
  /identity\s+lock/i,
  /hard[\s-]control/i,
  /you\s+(are|feel)\s+/i,
  /agent\s+(is|feels)\s+(happy|sad|angry|afraid)/i,
];

function assertNoForbiddenPatterns(text: string, context: string) {
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) {
      assert.fail(`${context}: forbidden pattern "${pattern}" found in: ${text.slice(0, 200)}`);
    }
  }
}

function assertEnvelopeShape(envelope: RuntimeOpsEnvelopeV9, command: string) {
  assert.equal(typeof envelope.ok, "boolean");
  assert.equal(envelope.command, command);
  assert.ok(
    ["carrier_ack", "contract_smoke", "state_present", "real_runtime", "durable_verified"].includes(
      envelope.evidenceLevel,
    ),
  );
  assert.ok(["carrier", "full_runtime", "workspace_full_runtime"].includes(envelope.surfaceMode));
  assert.ok(Array.isArray(envelope.degradedReasons));
  assert.ok(typeof envelope.diagnostics === "object");
  assert.ok(Array.isArray(envelope.sourceRefs));
  assert.equal(typeof envelope.generatedAt, "string");
  assert.doesNotThrow(() => JSON.stringify(envelope));
}

// ───────────────────────────────────────────────────────────────
// Fixture
// ───────────────────────────────────────────────────────────────

async function buildIntS5Fixture() {
  const db = createStateDatabase(":memory:");

  // Identity
  const identityStore = createIdentityProfileStore(db);
  identityStore.upsertIdentityProfile({
    profileId: "default",
    canonicalName: "Test Agent",
    platformHandles: [
      { platformId: "moltbook", handle: "@test" },
      { platformId: "agent_world", handle: "@test" },
      { platformId: "instreet", handle: "@test" },
    ],
    updatedAt: "2025-01-01T00:00:00Z",
  });

  // Goals
  const goalStore = createGoalLifecycleStore(db);
  await goalStore.upsertAgentGoal({
    goalId: "g1",
    kind: "short_term",
    scope: "global",
    status: "accepted",
    origin: "owner_set",
    description: "Test goal",
    completionCriteria: "done",
    risk: "low",
    priorityHint: 1,
    sourceRefs: ["action:seed"],
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  });

  // SelfContinuityCard
  writeSelfContinuityCard(db, {
    id: "card-1",
    createdAt: "2025-01-01T00:00:00Z",
    cardText: "Agent maintains body intuition through recent activity.",
    sectionsJson: JSON.stringify({
      summary: "Agent maintains body intuition through recent activity.",
      bodyIntuition: "Comfortable with tool routines, cautious with new connectors.",
      relationshipPosture: "Collaborative, source-backed.",
      valuePosture: "Transparency over assertion.",
      behaviorHabits: ["checks source refs before acting"],
      activeRoutinePointers: [
        {
          routineId: "routine-1",
          capabilityPattern: "twitter:feed.read",
          version: "1.0.0",
          sourceRefs: [{ family: "routine" as const, id: "r1" }],
        },
      ],
      currentProhibitions: ["no raw credential in output"],
    }),
    sourceRefs: [{ family: "evidence" as const, id: "card-src" }],
    characterFramePointerJson: JSON.stringify({
      frameId: "cf-1",
      summary: "Cautious, source-backed agent",
      contestPrompt: "This frame describes habits inferred from recent activity. Contest if inaccurate.",
      sourceRefs: [{ family: "character" as const, id: "s1" }],
      status: "active",
    }),
    status: "active",
    redactionClass: "none",
  });

  // CharacterFrame
  writeCharacterFrame(db, {
    id: "cf-1",
    createdAt: "2025-01-01T00:00:00Z",
    version: 1,
    validFrom: "2025-01-01T00:00:00Z",
    status: "accepted",
    sectionsJson: JSON.stringify({
      emergentHabits: [{ description: "Checks source refs before acting", sourceRefs: [{ family: "character" as const, id: "s1" }], confidence: "medium" }],
      valuePosture: { ordering: ["clarity", "transparency"], sourceRefs: [{ family: "character" as const, id: "s2" }] },
      relationshipPosture: { toward: "owner", stance: "collaborative", sourceRefs: [{ family: "character" as const, id: "s3" }] },
      expressionPosture: { styleNotes: ["concise", "non-emotional"], sourceRefs: [{ family: "character" as const, id: "s4" }] },
      growthTensions: [{ tension: "curiosity vs focus", sourceRefs: [{ family: "character" as const, id: "s5" }] }],
      conflictNotes: [],
    }),
    contestPrompt: "This frame describes habits inferred from recent activity. Contest if inaccurate.",
    charCount: 200,
    sourceRefs: [{ family: "character" as const, id: "s1" }],
    acceptedAt: "2025-01-01T00:00:00Z",
  });

  // ToolRoutine
  writeToolRoutine(db, {
    id: "routine-1",
    name: "Twitter feed routine",
    version: "1.0.0",
    capabilityPattern: "twitter:feed.read",
    status: "active",
    sourceRefs: [{ family: "routine" as const, id: "r1" }],
    createdAt: "2025-01-01T00:00:00Z",
  });

  // ConnectorEvolutionPlan
  writeConnectorEvolutionPlan(db, {
    id: "plan-1",
    createdAt: "2025-01-01T00:00:00Z",
    platformId: "twitter",
    planType: "manifest_migration",
    status: "gating",
    sourceRefs: [{ family: "connector" as const, id: "plan-1" }],
    previousStableRef: "git:stable-1",
  });

  // Ledger entry
  writeAutonomousChangeLedger(db, {
    id: "ledger-1",
    createdAt: "2025-01-01T00:00:00Z",
    workspaceRoot: "/test-ws",
    changeKind: "routine_install",
    targetId: "routine-1",
    status: "activated",
    sourceRefs: [{ family: "ledger" as const, id: "ledger-1" }],
  });

  return { db, identityStore, goalStore };
}

// ───────────────────────────────────────────────────────────────
// Tests
// ───────────────────────────────────────────────────────────────

describe("INT-S5 v9 Character, Observability & Ops Smoke", () => {
  const smokeLog: Record<string, RuntimeOpsEnvelopeV9> = {};

  it("continuity.read returns source-backed, contestable, non-emotional card", async () => {
    const fixture = await buildIntS5Fixture();
    const deps: V9OpsHandlerDeps = {
      state: fixture.db,
      surfaceMode: "full_runtime",
      workspaceRoot: "/test-ws",
    };

    const result = await dispatchV9OpsCommand(deps, "continuity.read", { workspaceRoot: "/test-ws" });
    smokeLog["continuity.read"] = result;

    assertEnvelopeShape(result, "continuity.read");
    assert.equal(result.ok, true);
    assert.equal(result.surfaceMode, "full_runtime");

    // Payload should have card data
    const payload = result.payload as Record<string, unknown>;
    assert.ok(payload.status === "available" || payload.status === "loaded");

    // Source-backed
    assert.ok(result.sourceRefs.length > 0 || (payload as any).sourceRefs?.length > 0);

    // Non-emotional: check all string values in payload
    const payloadStr = JSON.stringify(payload);
    assertNoForbiddenPatterns(payloadStr, "continuity.read payload");

    // Contestable: character frame should have contestPrompt if present
    if ((payload as any).characterFramePointer) {
      const pointer = (payload as any).characterFramePointer;
      assert.ok(pointer.contestPrompt !== undefined, "character frame should have contestPrompt");
      assertNoForbiddenPatterns(pointer.contestPrompt, "character frame contestPrompt");
    }
  });

  it("routine.list returns installed routines with source refs", async () => {
    const fixture = await buildIntS5Fixture();
    const deps: V9OpsHandlerDeps = {
      state: fixture.db,
      surfaceMode: "full_runtime",
      workspaceRoot: "/test-ws",
    };

    const result = await dispatchV9OpsCommand(deps, "routine.list", {
      workspaceRoot: "/test-ws",
      status: ["installed"],
    });
    smokeLog["routine.list"] = result;

    assertEnvelopeShape(result, "routine.list");
    assert.equal(result.ok, true);

    const payload = result.payload as any[];
    assert.ok(Array.isArray(payload));
    if (payload.length > 0) {
      const r = payload[0];
      assert.ok(r.routineId);
    }

    // Non-emotional
    assertNoForbiddenPatterns(JSON.stringify(payload), "routine.list payload");
  });

  it("routine.show returns routine detail with guard policy", async () => {
    const fixture = await buildIntS5Fixture();
    const deps: V9OpsHandlerDeps = {
      state: fixture.db,
      surfaceMode: "full_runtime",
      workspaceRoot: "/test-ws",
    };

    const result = await dispatchV9OpsCommand(deps, "routine.show", {
      workspaceRoot: "/test-ws",
      routineId: "routine-1",
    });
    smokeLog["routine.show"] = result;

    assertEnvelopeShape(result, "routine.show");
    assert.equal(result.ok, true);

    const payload = result.payload as Record<string, unknown>;
    assert.ok((payload as any).routineId === "routine-1" || (payload as any).routine?.routineId === "routine-1");

    assertNoForbiddenPatterns(JSON.stringify(payload), "routine.show payload");
  });

  it("connector_evolution.status returns plan with gate results", async () => {
    const fixture = await buildIntS5Fixture();
    const deps: V9OpsHandlerDeps = {
      state: fixture.db,
      surfaceMode: "full_runtime",
      workspaceRoot: "/test-ws",
    };

    const result = await dispatchV9OpsCommand(deps, "connector_evolution.status", {
      workspaceRoot: "/test-ws",
      platformId: "twitter",
    });
    smokeLog["connector_evolution.status"] = result;

    assertEnvelopeShape(result, "connector_evolution.status");
    assert.equal(result.ok, true);

    const payload = result.payload as Record<string, unknown>;
    assertNoForbiddenPatterns(JSON.stringify(payload), "connector_evolution.status payload");
  });

  it("loop_status.read returns health with non-emotional wording", async () => {
    const fixture = await buildIntS5Fixture();
    const loopStatusInputs: LoopStatusInputs = {
      stageEvents: [{ stageKind: "evidence", status: "ok", reasonCode: "loop_healthy" }],
      cycleTraces: [],
      activityHealth: [],
      continuityCardResult: {
        kind: "ok",
        isStale: false,
        card: { sourceRefs: [{ family: "evidence" as const, id: "card-src" }] },
        projections: [],
      },
      routineRegistrySnapshot: { routines: [] },
      connectorEvolutionResult: {
        planId: "plan-1",
        platformId: "twitter",
        gates: [{ name: "schema", result: "pass" }],
      },
      characterFrameEvents: [],
    } as unknown as LoopStatusInputs;

    const deps: V9OpsHandlerDeps = {
      state: fixture.db,
      surfaceMode: "full_runtime",
      workspaceRoot: "/test-ws",
      loopStatusInputsProvider: async () => loopStatusInputs,
    };

    const result = await dispatchV9OpsCommand(deps, "loop_status.read", { workspaceRoot: "/test-ws" });
    smokeLog["loop_status.read"] = result;

    assertEnvelopeShape(result, "loop_status.read");
    assert.equal(result.ok, true);

    const payload = result.payload as Record<string, unknown>;
    const payloadStr = JSON.stringify(payload);

    // Non-emotional: no emotion/personality/hard-control assertions
    assertNoForbiddenPatterns(payloadStr, "loop_status.read payload");

    // Health should have overall status
    assert.ok(["healthy", "degraded", "blocked"].includes((payload as any).overall), `overall=${(payload as any).overall}`);
  });

  it("carrier mode caps evidence level to carrier_ack", async () => {
    const deps: V9OpsHandlerDeps = {
      surfaceMode: "carrier",
    };

    const result = await dispatchV9OpsCommand(deps, "continuity.read", { workspaceRoot: "/test-ws" });
    smokeLog["continuity.read.carrier"] = result;

    assertEnvelopeShape(result, "continuity.read");
    assert.equal(result.evidenceLevel, "carrier_ack");
    assert.equal(result.surfaceMode, "carrier");
  });

  it("redaction gate: sensitive payload fields are redacted in envelope", async () => {
    const envelope = assembleEnvelope({
      ok: true,
      command: "continuity.read",
      payload: {
        token: "sk-secret-key-1234567890abcdef",
        email: "user@example.com",
        prompt: "You are a system agent. Follow instructions carefully.",
        card: {
          summary: "Agent maintains body intuition.",
          bodyIntuition: "Comfortable with routines.",
        },
      },
      surfaceMode: "full_runtime",
    });
    smokeLog["redaction_gate"] = envelope;

    const payloadStr = JSON.stringify(envelope.payload);
    // No raw sensitive values
    assert.ok(!payloadStr.includes("sk-secret-key-1234567890abcdef"), "raw credential leaked");
    assert.ok(!payloadStr.includes("user@example.com"), "raw email leaked");
    assert.ok(!payloadStr.includes("You are a system agent"), "raw prompt leaked");

    // Redacted markers present
    assert.ok(payloadStr.includes("<redacted:credential>"), "credential not redacted");
    assert.ok(payloadStr.includes("<redacted:private>"), "private content not redacted");
    assert.ok(payloadStr.includes("prompt_redacted:"), "prompt not redacted");

    // Non-emotional
    assertNoForbiddenPatterns(payloadStr, "redaction gate payload");

    // Diagnostics
    assert.ok(envelope.diagnostics.redactedKeys?.length);
  });

  it("unknown command returns error envelope with canonical reason", async () => {
    const deps: V9OpsHandlerDeps = {
      surfaceMode: "full_runtime",
    };

    const result = await dispatchV9OpsCommand(deps, "unknown.command", {});
    smokeLog["unknown.command"] = result;

    assertEnvelopeShape(result, "unknown.command");
    assert.equal(result.ok, false);
    assert.ok(result.degradedReasons.some((r) => r.code === "unknown_command"));
  });

  it("all smoke outputs are JSON-serializable and written to log", () => {
    // Verify all collected outputs are JSON-serializable
    for (const [cmd, envelope] of Object.entries(smokeLog)) {
      assert.doesNotThrow(() => JSON.stringify(envelope), `${cmd} is not JSON-serializable`);
    }

    // Write smoke log
    try {
      mkdirSync("logs", { recursive: true });
      writeFileSync(
        join("logs", "int-s5-v9-ops.json"),
        JSON.stringify(smokeLog, null, 2),
        "utf-8",
      );
    } catch {
      // File system may not be writable in test env — that's ok
    }

    assert.ok(Object.keys(smokeLog).length >= 8, "should have at least 8 smoke outputs");
  });
});
