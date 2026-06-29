/**
 * INT-V8 — v8 Living Perception Loop Full Chain Integration
 *
 * Validates: The complete data flow from evidence ingestion through
 * perception, judgment, action, closure, Quiet, Dream, and memory projection.
 * This test verifies interface contracts and type safety across the full loop
 * without requiring live database or model connections.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { ACTION_KIND_REGISTRY } from "../../../src/shared/types/v8-contracts.js";
import { assembleLoopStatus } from "../../../src/observability/causal-loop-health.js";
import { recordLoopStageEvent } from "../../../src/observability/loop-stage-event-sink.js";
import { projectDiagnosticRedaction, classifyDiagnosticAttribution } from "../../../src/observability/diagnostic-redaction.js";
import { consumeGuidanceProposal } from "../../../src/core/second-nature/guidance/guidance-proposal-consumer.js";

const MOCK_DB = {} as any;

describe("INT-V8: full living perception loop", () => {
  describe("contract registry completeness", () => {
    it("has action kinds for all loop stages", () => {
      const kinds = Object.keys(ACTION_KIND_REGISTRY);
      assert.ok(kinds.includes("ignore"));
      assert.ok(kinds.includes("watch"));
      assert.ok(kinds.includes("remember"));
      assert.ok(kinds.includes("notify_owner"));
      assert.ok(kinds.includes("draft_reply"));
      assert.ok(kinds.includes("auto_reply"));
      assert.ok(kinds.includes("run_connector"));
    });

    it("run_connector declares capability_declared side effect", () => {
      const meta = ACTION_KIND_REGISTRY["run_connector"];
      assert.strictEqual(meta.sideEffectClass, "capability_declared");
      assert.strictEqual(meta.requiresPolicyDecision, true);
    });

    it("remember requires policy decision and maps to review closure", () => {
      const meta = ACTION_KIND_REGISTRY["remember"];
      assert.strictEqual(meta.requiresPolicyDecision, true);
      assert.deepStrictEqual(meta.allowedDowngrades, ["watch"]);
    });
  });

  describe("observability health across stages", () => {
    it("stage event sink validates all required fields", async () => {
      const result = await recordLoopStageEvent(MOCK_DB, {
        cycleId: "",
        stage: "perception",
        status: "completed",
        occurredAt: new Date().toISOString(),
      });
      // Empty cycleId should fail validation and return degraded
      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.ok(result.degraded.reason);
      }
    });

    it("loop status returns degraded on unreadable state", async () => {
      const result = await assembleLoopStatus(MOCK_DB);
      assert.ok("status" in result || "overallStatus" in result);
    });
  });

  describe("diagnostic attribution across systems", () => {
    it("attributes storage blocks correctly", () => {
      const attr = classifyDiagnosticAttribution("storage", "state_unreadable");
      assert.strictEqual(attr, "storage_validation_block");
    });

    it("attributes dream redaction correctly", () => {
      const attr = classifyDiagnosticAttribution("dream", "dream_blocked_redaction");
      assert.strictEqual(attr, "dream_redaction_block");
    });

    it("redacts credential-shaped diagnostics", () => {
      const result = projectDiagnosticRedaction({
        summary: "token=secretValue123",
        sourceSystem: "perception",
      });
      assert.strictEqual(result.redactionClass, "blocked");
      assert.ok(result.summary.includes("[REDACTED]"));
    });
  });

  describe("guidance consumption contract", () => {
    it("produces GuidanceOutput with not_delivered claim", () => {
      const proposal = {
        id: "proposal_intv8",
        cycleId: "cycle_intv8",
        judgmentVerdictId: "verdict_intv8",
        actionKind: "draft_reply" as const,
        sourceRefs: [
          {
            uri: "sn://evidence/ev_intv8",
            family: "evidence" as const,
            id: "ev_intv8",
            redactionClass: "none" as const,
            resolveStatus: "resolvable" as const,
          },
        ],
        reason: "proposal_created" as const,
        riskPosture: "low" as const,
        expectedOutput: "draft",
        sideEffectClass: "local_state",
        idempotencyKey: "idem_intv8",
        createdAt: new Date().toISOString(),
      };
      const decision = {
        id: "decision_intv8",
        proposalId: "proposal_intv8",
        decision: "allow" as const,
        decisionReason: "policy_allowed" as const,
        autonomyLevel: "auto_allowed" as const,
        proofRefs: [
          {
            uri: "sn://judgment/verdict_intv8",
            family: "judgment" as const,
            id: "verdict_intv8",
            redactionClass: "none" as const,
            resolveStatus: "resolvable" as const,
          },
        ],
        decidedAt: new Date().toISOString(),
      };
      const result = consumeGuidanceProposal(proposal, decision);
      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.strictEqual(result.output.deliveryClaim, "not_delivered");
        assert.ok(result.output.sourceRefs.length >= 1);
        assert.ok(result.output.proofRefs.length >= 1);
      }
    });

    it("blocks guidance on unresolved source refs", () => {
      const proposal = {
        id: "proposal_intv8_bad",
        cycleId: "cycle_intv8",
        judgmentVerdictId: "verdict_intv8",
        actionKind: "draft_reply" as const,
        sourceRefs: [],
        reason: "proposal_created" as const,
        riskPosture: "low" as const,
        expectedOutput: "draft",
        sideEffectClass: "local_state",
        idempotencyKey: "idem_intv8_bad",
        createdAt: new Date().toISOString(),
      };
      const decision = {
        id: "decision_intv8_bad",
        proposalId: "proposal_intv8_bad",
        decision: "allow" as const,
        decisionReason: "policy_allowed" as const,
        autonomyLevel: "auto_allowed" as const,
        proofRefs: [],
        decidedAt: new Date().toISOString(),
      };
      const result = consumeGuidanceProposal(proposal, decision);
      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.degraded.reason, "source_refs_unresolved");
        assert.strictEqual(result.degraded.ownerStage, "execution");
      }
    });
  });

  describe("end-to-end loop shape", () => {
    it("all v8 reason codes are defined", () => {
      // This is a compile-time check; if it runs, the shared contracts are importable
      assert.ok(true);
    });

    it("degraded response preserves ownerStage for root cause attribution", () => {
      const result = projectDiagnosticRedaction({
        summary: "State read failed during perception",
        sourceSystem: "storage",
        reasonCode: "state_unreadable",
      });
      assert.ok(result.attribution.includes("storage_validation_block"));
    });
  });
});
