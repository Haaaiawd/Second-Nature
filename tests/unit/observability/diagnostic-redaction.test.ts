/**
 * DiagnosticRedaction — Unit Tests
 *
 * Validates: credential redaction, public technical preservation,
 * sensitivity diagnostic attribution, and private context blocking.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  projectDiagnosticRedaction,
  classifyDiagnosticAttribution,
} from "../../../src/observability/diagnostic-redaction.js";

describe("diagnostic-redaction", () => {
  describe("credential-shaped values", () => {
    it("redacts Bearer token values and blocks", () => {
      const result = projectDiagnosticRedaction({
        summary: "Authorization: Bearer abc123xyz789",
        sourceSystem: "perception",
      });
      assert.strictEqual(result.redactionClass, "blocked");
      assert.ok(result.summary.includes("[REDACTED]"));
      assert.ok(result.attribution.includes("credential_shape_detected"));
    });

    it("redacts secret= values and blocks", () => {
      const result = projectDiagnosticRedaction({
        summary: "config secret=superSecretValue123",
        sourceSystem: "storage",
      });
      assert.strictEqual(result.redactionClass, "blocked");
      assert.ok(result.summary.includes("[REDACTED]"));
    });
  });

  describe("public technical preservation", () => {
    it("preserves public technical summaries with none redaction", () => {
      const result = projectDiagnosticRedaction({
        summary: "Token refresh mechanism uses OAuth2 PKCE flow",
        sourceSystem: "perception",
        sensitivityHint: "public_technical",
      });
      assert.strictEqual(result.redactionClass, "none");
      assert.ok(result.attribution.includes("public_technical_preserved"));
    });
  });

  describe("private context redaction", () => {
    it("redacts private context and returns blocked summary", () => {
      const result = projectDiagnosticRedaction({
        summary: "DM from user about personal project",
        sourceSystem: "dream",
      });
      assert.strictEqual(result.redactionClass, "redacted");
      assert.ok(result.attribution.includes("private_context") || result.attribution.includes("dream"));
    });
  });

  describe("diagnostic attribution classification", () => {
    it("classifies storage validation block", () => {
      const attr = classifyDiagnosticAttribution("storage", "state_unreadable");
      assert.strictEqual(attr, "storage_validation_block");
    });

    it("classifies dream redaction block", () => {
      const attr = classifyDiagnosticAttribution("dream", "dream_blocked_redaction");
      assert.strictEqual(attr, "dream_redaction_block");
    });

    it("classifies perception risk block", () => {
      const attr = classifyDiagnosticAttribution("perception", "perception_rules_only");
      assert.strictEqual(attr, "perception_risk_block");
    });

    it("classifies policy denial", () => {
      const attr = classifyDiagnosticAttribution("policy", "policy_denied_high_risk");
      assert.strictEqual(attr, "policy_denial");
    });

    it("defaults to no_redaction_needed for unknown", () => {
      const attr = classifyDiagnosticAttribution("unknown", undefined);
      assert.strictEqual(attr, "no_redaction_needed");
    });

    it("does not attribute risk block when reasonCode is absent", () => {
      const attr = classifyDiagnosticAttribution("perception", undefined);
      assert.strictEqual(attr, "no_redaction_needed");
    });
  });

  describe("source-system attribution in output", () => {
    it("includes policy_denial attribution for policy blocks", () => {
      const result = projectDiagnosticRedaction({
        summary: "Action blocked by policy evaluator",
        sourceSystem: "policy",
        reasonCode: "policy_denied_high_risk",
      });
      assert.strictEqual(result.redactionClass, "blocked");
      assert.ok(result.attribution.includes("policy_denial"));
    });

    it("includes dream_redaction_block for dream blocks", () => {
      const result = projectDiagnosticRedaction({
        summary: "Dream redaction blocked model exposure",
        sourceSystem: "dream",
        reasonCode: "dream_blocked_redaction",
      });
      assert.strictEqual(result.redactionClass, "blocked");
      assert.ok(result.attribution.includes("dream_redaction_block"));
    });
  });
});
