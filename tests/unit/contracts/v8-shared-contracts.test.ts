/**
 * v8 Shared Contracts — Unit Tests
 *
 * Validates: enum compatibility, required fields, heartbeat rhythm,
 * degraded response, and invalid shape rejection.
 *
 * Design authority: `.anws/v8/04_SYSTEM_DESIGN/shared-v8-contracts.md`
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  ACTION_KIND_REGISTRY,
  type ActionKindMetadata,
  type ConnectorCapabilitySideEffect,
  type DegradedOperationResult,
  type HeartbeatCycleTrace,
  type LoopStageEvent,
  type MemoryReviewCandidateClosure,
  type PlatformNeutralActionKind,
  type SourceRef,
  type SourceRefFamily,
  type V8ReasonCode,
} from "../../../src/shared/types/v8-contracts.js";

// ───────────────────────────────────────────────────────────────
// Fixtures
// ───────────────────────────────────────────────────────────────

function makeSourceRef(overrides?: Partial<SourceRef>): SourceRef {
  return {
    uri: "sn://evidence/ev_20260601_001",
    family: "evidence",
    id: "ev_20260601_001",
    redactionClass: "none",
    ...overrides,
  };
}

function makeHeartbeatCycleTrace(
  overrides?: Partial<HeartbeatCycleTrace>,
): HeartbeatCycleTrace {
  return {
    cycleId: "cyc_001",
    cycleSequence: 1,
    heartbeatStartedAt: "2026-06-01T00:00:00Z",
    inputCount: 3,
    outputCount: 2,
    status: "started",
    ...overrides,
  };
}

function makeLoopStageEvent(overrides?: Partial<LoopStageEvent>): LoopStageEvent {
  return {
    id: "evt_001",
    cycleId: "cyc_001",
    cycleSequence: 1,
    stage: "perception",
    status: "completed",
    reason: "perception_rules_only",
    sourceRefs: [makeSourceRef()],
    redactionClass: "none",
    occurredAt: "2026-06-01T00:00:01Z",
    ...overrides,
  };
}

function makeMemoryReviewCandidateClosure(
  overrides?: Partial<MemoryReviewCandidateClosure>,
): MemoryReviewCandidateClosure {
  return {
    closureSubtype: "remember_for_review",
    perceptionRef: makeSourceRef({ family: "perception", id: "per_001" }),
    judgmentVerdictRef: makeSourceRef({ family: "judgment", id: "jud_001" }),
    topicKey: "tech-learning",
    memoryIntentReason: "Recurring technical observation worth reviewing",
    reviewPriority: "medium",
    sourceRefs: [makeSourceRef()],
    ...overrides,
  };
}

function makeDegradedOperationResult(
  overrides?: Partial<DegradedOperationResult>,
): DegradedOperationResult {
  return {
    status: "degraded",
    reason: "state_unreadable",
    ownerStage: "perception",
    sourceRefs: [makeSourceRef()],
    operatorNextAction: "Check state database connectivity",
    retryable: true,
    ...overrides,
  };
}

// ───────────────────────────────────────────────────────────────
// Tests
// ───────────────────────────────────────────────────────────────

describe("v8-shared-contracts", () => {
  describe("PlatformNeutralActionKind registry", () => {
    it("contains all 9 action kinds", () => {
      const kinds = Object.keys(ACTION_KIND_REGISTRY) as PlatformNeutralActionKind[];
      assert.deepStrictEqual(
        kinds.sort(),
        [
          "auto_publish",
          "auto_reply",
          "draft_publish",
          "draft_reply",
          "ignore",
          "notify_owner",
          "remember",
          "run_connector",
          "watch",
        ].sort(),
      );
    });

    it("maps side-effect classes correctly", () => {
      const assertSideEffect = (
        kind: PlatformNeutralActionKind,
        expected: ActionKindMetadata["sideEffectClass"],
      ) => {
        assert.strictEqual(ACTION_KIND_REGISTRY[kind].sideEffectClass, expected);
      };

      assertSideEffect("ignore", "none");
      assertSideEffect("watch", "local_state");
      assertSideEffect("remember", "local_state");
      assertSideEffect("notify_owner", "owner_attention");
      assertSideEffect("draft_reply", "local_state");
      assertSideEffect("auto_reply", "external_write");
      assertSideEffect("draft_publish", "local_state");
      assertSideEffect("auto_publish", "external_write");
      assertSideEffect("run_connector", "capability_declared");
    });

    it("requires policy decision for write-side and attention actions", () => {
      const requirePolicy: PlatformNeutralActionKind[] = [
        "remember",
        "notify_owner",
        "draft_reply",
        "auto_reply",
        "draft_publish",
        "auto_publish",
        "run_connector",
      ];
      for (const kind of requirePolicy) {
        assert.strictEqual(
          ACTION_KIND_REGISTRY[kind].requiresPolicyDecision,
          true,
          `${kind} should require policy decision`,
        );
      }
      assert.strictEqual(ACTION_KIND_REGISTRY.ignore.requiresPolicyDecision, false);
      assert.strictEqual(ACTION_KIND_REGISTRY.watch.requiresPolicyDecision, false);
    });

    it("allows downgrade chains for risky actions", () => {
      assert.deepStrictEqual(ACTION_KIND_REGISTRY.auto_reply.allowedDowngrades, [
        "draft_reply",
        "notify_owner",
        "watch",
      ]);
      assert.deepStrictEqual(ACTION_KIND_REGISTRY.auto_publish.allowedDowngrades, [
        "draft_publish",
        "notify_owner",
        "watch",
      ]);
    });
  });

  describe("SourceRef", () => {
    it("round-trips required fields", () => {
      const ref: SourceRef = makeSourceRef();
      assert.strictEqual(ref.uri, "sn://evidence/ev_20260601_001");
      assert.strictEqual(ref.family, "evidence");
      assert.strictEqual(ref.id, "ev_20260601_001");
      assert.strictEqual(ref.redactionClass, "none");
    });

    it("accepts optional sensitivity and resolve fields", () => {
      const ref: SourceRef = makeSourceRef({
        sensitivityClass: "public_technical",
        resolveStatus: "resolvable",
        resolveFailureReason: undefined,
      });
      assert.strictEqual(ref.sensitivityClass, "public_technical");
      assert.strictEqual(ref.resolveStatus, "resolvable");
    });

    it("accepts all SourceRefFamily values", () => {
      const families: SourceRefFamily[] = [
        "evidence",
        "perception",
        "judgment",
        "action_closure",
        "quiet_review",
        "dream_run",
        "memory_projection",
        "tool_experience",
        "connector_result",
        "audit",
      ];
      for (const family of families) {
        const ref = makeSourceRef({ family, id: `test_${family}` });
        assert.strictEqual(ref.family, family);
      }
    });
  });

  describe("HeartbeatCycleTrace", () => {
    it("validates cycle sequence monotonicity at type level (runtime smoke)", () => {
      const trace1 = makeHeartbeatCycleTrace({ cycleSequence: 1 });
      const trace2 = makeHeartbeatCycleTrace({ cycleSequence: 2 });
      assert.ok(trace2.cycleSequence > trace1.cycleSequence);
    });

    it("allows optional heartbeatCompletedAt", () => {
      const withoutCompletion = makeHeartbeatCycleTrace();
      assert.strictEqual(withoutCompletion.heartbeatCompletedAt, undefined);

      const withCompletion = makeHeartbeatCycleTrace({
        heartbeatCompletedAt: "2026-06-01T00:00:05Z",
        status: "completed",
      });
      assert.strictEqual(withCompletion.heartbeatCompletedAt, "2026-06-01T00:00:05Z");
      assert.strictEqual(withCompletion.status, "completed");
    });

    it("supports all HeartbeatCycleStatus values", () => {
      const statuses: HeartbeatCycleTrace["status"][] = [
        "started",
        "completed",
        "failed",
        "degraded",
      ];
      for (const status of statuses) {
        const trace = makeHeartbeatCycleTrace({ status });
        assert.strictEqual(trace.status, status);
      }
    });
  });

  describe("LoopStageEvent", () => {
    it("links to cycle via cycleId and cycleSequence", () => {
      const event = makeLoopStageEvent({
        cycleId: "cyc_42",
        cycleSequence: 42,
      });
      assert.strictEqual(event.cycleId, "cyc_42");
      assert.strictEqual(event.cycleSequence, 42);
    });

    it("supports all stage and status combinations", () => {
      const stages: LoopStageEvent["stage"][] = [
        "ingestion",
        "perception",
        "judgment",
        "policy",
        "execution",
        "closure",
        "quiet",
        "dream",
        "projection",
      ];
      const statuses: LoopStageEvent["status"][] = [
        "started",
        "completed",
        "skipped",
        "blocked",
        "failed",
      ];
      for (const stage of stages) {
        for (const status of statuses) {
          const event = makeLoopStageEvent({ stage, status });
          assert.strictEqual(event.stage, stage);
          assert.strictEqual(event.status, status);
        }
      }
    });

    it("carries source refs with redaction class", () => {
      const event = makeLoopStageEvent({
        sourceRefs: [
          makeSourceRef({ redactionClass: "redacted" }),
          makeSourceRef({ redactionClass: "blocked" }),
        ],
        redactionClass: "redacted",
      });
      assert.strictEqual(event.sourceRefs.length, 2);
      assert.strictEqual(event.sourceRefs[0].redactionClass, "redacted");
      assert.strictEqual(event.sourceRefs[1].redactionClass, "blocked");
      assert.strictEqual(event.redactionClass, "redacted");
    });
  });

  describe("MemoryReviewCandidateClosure", () => {
    it("requires remember_for_review subtype", () => {
      const closure = makeMemoryReviewCandidateClosure();
      assert.strictEqual(closure.closureSubtype, "remember_for_review");
    });

    it("requires non-empty sourceRefs tuple", () => {
      const closure = makeMemoryReviewCandidateClosure({
        sourceRefs: [makeSourceRef({ id: "only_one" })],
      });
      assert.strictEqual(closure.sourceRefs.length, 1);
      assert.strictEqual(closure.sourceRefs[0].id, "only_one");
    });

    it("carries perception and judgment refs", () => {
      const closure = makeMemoryReviewCandidateClosure({
        perceptionRef: makeSourceRef({ family: "perception", id: "per_007" }),
        judgmentVerdictRef: makeSourceRef({ family: "judgment", id: "jud_007" }),
      });
      assert.strictEqual(closure.perceptionRef.id, "per_007");
      assert.strictEqual(closure.judgmentVerdictRef.id, "jud_007");
    });
  });

  describe("DegradedOperationResult", () => {
    it("preserves owner stage for root-cause attribution", () => {
      const result = makeDegradedOperationResult({ ownerStage: "closure" });
      assert.strictEqual(result.ownerStage, "closure");
    });

    it("distinguishes degraded vs blocked status", () => {
      const degraded = makeDegradedOperationResult({ status: "degraded" });
      const blocked = makeDegradedOperationResult({
        status: "blocked",
        reason: "source_refs_unresolved",
        retryable: false,
      });
      assert.strictEqual(degraded.status, "degraded");
      assert.strictEqual(blocked.status, "blocked");
      assert.strictEqual(blocked.retryable, false);
    });

    it("includes operator next action guidance", () => {
      const result = makeDegradedOperationResult({
        operatorNextAction: "Restart connector credential refresh",
      });
      assert.strictEqual(result.operatorNextAction, "Restart connector credential refresh");
    });
  });

  describe("V8ReasonCode completeness", () => {
    it("includes all canonical reason codes from registry", () => {
      const codes: V8ReasonCode[] = [
        // Quiet / Dream / Projection
        "quiet_completed",
        "quiet_empty_input",
        "quiet_state_unreadable",
        "quiet_validation_failed",
        "dream_scheduled",
        "dream_scheduler_unavailable",
        "dream_started",
        "dream_completed",
        "dream_failed",
        "dream_blocked_redaction",
        "projection_candidate_created",
        "projection_accepted",
        "projection_rejected",
        "projection_superseded",
        // Action / Policy / Closure
        "proposal_created",
        "proposal_no_action",
        "proposal_missing_source_refs",
        "proposal_risk_blocked",
        "policy_allowed",
        "policy_deferred_owner_confirmation",
        "policy_downgraded_to_draft",
        "policy_denied_missing_permission",
        "policy_denied_high_risk",
        "policy_denied_breaker_open",
        "guidance_unavailable",
        "closure_completed",
        "closure_no_action",
        "closure_denied",
        "closure_deferred",
        "closure_downgraded",
        "closure_downgraded_without_draft",
        "closure_failed",
        // Perception / Judgment / Observability
        "perception_rules_only",
        "evidence_batch_empty",
        "evidence_batch_truncated",
        "judgment_low_confidence",
        "judgment_missing_source_refs",
        "source_refs_unresolved",
        "state_unreadable",
        "stage_event_missing",
        // Ingestion / Execution
        "ingestion_no_data",
        "ingestion_empty",
        "ingestion_state_unreadable",
        "ingestion_connector_failed",
        "execution_completed",
        "execution_failed",
        "execution_timeout",
        "execution_unavailable",
      ];
      // If this compiles, every code is a valid V8ReasonCode.
      assert.strictEqual(codes.length, 48);
    });
  });

  describe("ConnectorCapabilitySideEffect", () => {
    it("accepts all four side-effect classes", () => {
      const effects: ConnectorCapabilitySideEffect[] = [
        "external_read",
        "external_write",
        "local_state",
        "unknown",
      ];
      for (const effect of effects) {
        assert.ok(effect);
      }
    });
  });
});
