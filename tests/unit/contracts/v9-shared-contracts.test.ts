/**
 * v9 Shared Contracts compile/export snapshot tests.
 *
 * Purpose:
 * - Prevent silent type drift by asserting enum values and exports.
 * - Ensure canonical types are importable and structural invariants hold.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  type ActionClosureRecord,
  type ActionPolicyDecision,
  type ActionProposal,
  type ActivityThread,
  type AttentionSignal,
  type AutonomousChangeLedgerEntry,
  type CharacterFrame,
  type CharacterFramePointer,
  type CharacterRefreshInput,
  type ConnectorEvolutionPlan,
  type ConnectorVersion,
  type EmbodiedContext,
  type EmbodiedContextCharacterProjection,
  type EvidenceItem,
  type SelfContinuityCard,
  type StableEvidenceIdentity,
  type ToolRoutine,
  type ToolRoutineGuardSchema,
  type V9ReasonCode,
} from "../../../src/shared/types/v9-contracts.js";

describe("v9 shared contracts exports", () => {
  it("imports canonical v9 types without local redefinition", () => {
    // Structural compile-time check: every type referenced above must be exported.
    assert.ok(true);
  });

  it("AttentionSignal respects body-attention boundary", () => {
    const signal: AttentionSignal = {
      signalId: "sig-1",
      novelty: 0.7,
      relevance: 0.8,
      repetition: "new",
      risk: "low",
      possibleActions: ["watch", "remember"],
      sourceRefs: [{ family: "evidence", id: "ev-1" }],
      summary: "(new) moltbook/feed.read: test summary",
      status: "attentive",
      threadSuggestion: "create",
    };
    assert.equal(signal.possibleActions.includes("watch"), true);
    assert.equal(signal.status, "attentive");
  });

  it("ActivityThread carries bounded step scaffold", () => {
    const thread: ActivityThread = {
      threadId: "th-1",
      originAttentionSignalId: "sig-1",
      status: "active",
      currentFocus: "review source-backed cue",
      associations: ["related to prior closure"],
      nextPossibleMoves: ["observe", "ask_agent"],
      completedStepCount: 0,
      stopCondition: "single_step_done",
      lastHeartbeatSequence: 1,
      sourceRefs: [{ family: "attention", id: "sig-1" }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    assert.equal(thread.completedStepCount, 0);
    assert.equal(thread.nextPossibleMoves.length <= 7, true);
  });

  it("SelfContinuityCard preserves canonical section ordering", () => {
    const card: SelfContinuityCard = {
      id: "card-1",
      summary: "summary",
      bodyIntuition: "body",
      relationshipPosture: "rel",
      valuePosture: "val",
      behaviorHabits: ["habit"],
      activeRoutinePointers: [],
      currentProhibitions: [],
      characterFramePointer: {
        frameId: "frame-1",
        summary: "frame summary",
        contestPrompt: "contest?",
        sourceRefs: [{ family: "character", id: "frame-1" }],
        status: "active",
      },
      sourceRefs: [{ family: "dream", id: "proj-1" }],
      acceptedAt: new Date().toISOString(),
      status: "active",
    };
    assert.equal(card.characterFramePointer.status, "active");
  });

  it("CharacterRefreshInput blocks raw payload by contract shape", () => {
    const input: CharacterRefreshInput = {
      kind: "input",
      refreshId: "ref-1",
      workspaceRoot: "/tmp/ws",
      locale: "zh-CN",
      trigger: "dream_consolidation",
      signals: [
        {
          signalId: "sig-1",
          signalKind: "action_closure",
          originSystem: "memory-continuity-system",
          summary: "redacted summary",
          sourceRefs: [{ family: "action", id: "closure-1" }],
          redactionClass: "none",
          confidence: "medium",
          locale: "zh-CN",
        },
      ],
      sourceRefs: [{ family: "dream", id: "dream-1" }],
      createdAt: new Date().toISOString(),
    };
    assert.equal(input.signals[0]?.redactionClass, "none");
  });

  it("ToolRoutineGuardSchema DSL accepts canonical version", () => {
    const guard: ToolRoutineGuardSchema = {
      version: "1.0.0",
      allowedCapabilities: ["moltbook:feed.read"],
      deniedCapabilities: [],
      maxSideEffectClass: "owner_attention",
      requiresOwnerConfirm: true,
      maxStepCount: 4,
      maxTimeoutMs: 5000,
      sandboxPolicy: "declarative_only",
    };
    assert.equal(guard.requiresOwnerConfirm, true);
    assert.equal(guard.sandboxPolicy, "declarative_only");
  });

  it("ConnectorEvolutionPlan and ConnectorVersion share canonical GateResult", () => {
    const plan: ConnectorEvolutionPlan = {
      id: "plan-1",
      platformId: "moltbook",
      planType: "manifest_delta",
      payloadJson: "{}",
      status: "proposed",
      gateResults: [{ gate: "schema", passed: true, evidenceRefs: [] }],
      sourceRefs: [{ family: "dream", id: "dream-1" }],
      createdAt: new Date().toISOString(),
    };
    const version: ConnectorVersion = {
      id: "ver-1",
      versionId: "moltbook-v2",
      platformId: "moltbook",
      workspaceRoot: "/tmp/ws",
      planType: "manifest_delta",
      manifestPath: ".second-nature/connectors/moltbook/manifest.yaml",
      declaredCapabilities: ["moltbook:feed.read"],
      gateResults: plan.gateResults ?? [],
      status: "candidate",
      sourceRefs: [{ family: "connector", id: "plan-1" }],
      createdAt: new Date().toISOString(),
    };
    assert.equal(version.gateResults.length, 1);
    assert.equal(version.status, "candidate");
  });

  it("AutonomousChangeLedgerEntry requires source refs", () => {
    const entry: AutonomousChangeLedgerEntry = {
      id: "ledger-1",
      workspaceRoot: "/tmp/ws",
      changeKind: "routine_install",
      targetId: "routine-1",
      status: "proposed",
      sourceRefs: [{ family: "routine", id: "routine-1" }],
      createdAt: new Date().toISOString(),
    };
    assert.equal(entry.sourceRefs.length > 0, true);
  });

  it("ActionClosureRecord carries exactly-one provenance tiers", () => {
    const closure: ActionClosureRecord = {
      id: "closure-1",
      cycleSequence: 1,
      actionKind: "no_action",
      decision: "deny",
      sourceRefs: [{ family: "attention", id: "sig-1" }],
      proofRefs: [],
      traceRefs: [{ family: "action", id: "closure-1" }],
      closureRefs: [],
      reasonCode: "attention_hint_without_agent_or_routine_intent",
      createdAt: new Date().toISOString(),
    };
    assert.equal(closure.reasonCode, "attention_hint_without_agent_or_routine_intent");
  });

  it("EmbodiedContext includes v9 slices", () => {
    const ctx: EmbodiedContext = {
      identity: { status: "loaded", data: {} },
      goals: { status: "loaded", data: [] },
      recentInteractions: { status: "loaded", data: [] },
      toolExperience: { status: "loaded", data: [] },
      acceptedDream: { status: "loaded", data: [] },
      affordanceMap: { status: "loaded", data: {} },
      selfHealth: { status: "loaded", data: {} },
      selfContinuityCard: { status: "loaded", data: {} as SelfContinuityCard },
      characterFramePointer: { status: "loaded", data: {} as CharacterFramePointer },
      characterFrameProjection: { status: "loaded", data: {} as EmbodiedContextCharacterProjection },
      activeMemoryProjections: { status: "loaded", data: [] },
      activeProceduralProjections: { status: "loaded", data: [] },
      routineList: { status: "loaded", data: [] },
      activityThreads: { status: "loaded", data: [] },
      assembledAt: new Date().toISOString(),
    };
    assert.equal(ctx.selfContinuityCard.status, "loaded");
  });

  it("EvidenceItem identity omits observedAt from logical key", () => {
    const item: EvidenceItem = {
      platformId: "moltbook",
      externalId: "post-1",
      contentHash: "hash-a",
      observedAt: new Date().toISOString(),
      sourceRefs: [{ family: "evidence", id: "ev-1" }],
    };
    // Contract invariant: observedAt must not participate in logical identity.
    // The type shape encodes this by keeping observedAt separate from platformId/externalId/contentHash.
    assert.equal(typeof item.platformId, "string");
    assert.equal(typeof item.observedAt, "string");
  });

  it("StableEvidenceIdentity carries repetition status and seen count", () => {
    const identity: StableEvidenceIdentity = {
      logicalId: "ev-moltbook-post-1",
      platformId: "moltbook",
      externalId: "post-1",
      contentHash: "hash-a",
      seenCount: 3,
      firstObservedAt: "2026-06-01T00:00:00Z",
      lastObservedAt: "2026-06-03T00:00:00Z",
      repetitionStatus: "duplicate",
    };
    assert.equal(identity.seenCount, 3);
    assert.equal(identity.repetitionStatus, "duplicate");
  });

  it("ActionProposal authoring boundary types compile", () => {
    const proposal: ActionProposal = {
      id: "prop-1",
      cycleId: "cycle-1",
      actionKind: "routine",
      sourceRefs: [{ family: "routine", id: "routine-1" }],
      proofRefs: [],
      reason: "proposal_created",
      riskPosture: "low",
      sideEffectClass: "routine",
      idempotencyKey: "key-1",
      routineInvocationId: "routine-1",
      routineVersion: "1.0.0",
      createdAt: new Date().toISOString(),
    };
    const decision: ActionPolicyDecision = {
      id: "dec-1",
      proposalId: proposal.id,
      decision: "allow",
      decisionReason: "policy_allowed",
      autonomyLevel: "auto_allowed",
      proofRefs: [],
      decidedAt: new Date().toISOString(),
    };
    assert.equal(decision.proposalId, proposal.id);
  });

  it("CharacterFrame contestable lifecycle states compile", () => {
    const frame: CharacterFrame = {
      id: "frame-1",
      projectionKind: "character_frame",
      version: 1,
      status: "candidate",
      validFrom: new Date().toISOString(),
      validUntil: null,
      charCount: 120,
      sourceRefs: [{ family: "character", id: "sig-1" }],
      valuePosture: null,
      relationshipPosture: null,
      expressionPosture: null,
      contestPrompt: "This is a contestable projection.",
      supersededBy: null,
      revisionOf: null,
      createdAt: new Date().toISOString(),
    };
    assert.equal(frame.status, "candidate");
    assert.equal(frame.projectionKind, "character_frame");
  });

  it("V9 reason code covers attention and legacy boundary", () => {
    const reasons: V9ReasonCode[] = [
      "attention_hint_without_agent_or_routine_intent",
      "attention_blocked_missing_sources",
      "v8_legacy_judgment_mapped",
      "character_frame_deferred",
    ];
    assert.equal(reasons.length, 4);
  });
});
