/**
 * SensitivityClassifier — Unit Tests
 *
 * Validates: public_technical vs credential-shaped sensitive classification,
 * private_context detection, empty input, batch classification.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  classifyEvidenceSensitivity,
  classifyEvidenceBatch,
} from "../../../src/core/second-nature/perception/sensitivity-classifier.js";

describe("sensitivity-classifier", () => {
  describe("public_technical classification", () => {
    it("classifies token discussion as public_technical", () => {
      const result = classifyEvidenceSensitivity(
        "The token is used for authentication in this API.",
      );
      assert.strictEqual(result.sensitivityClass, "public_technical");
      assert.strictEqual(result.reason, "technical_vocabulary_only");
      assert.ok(result.confidence >= 0.7);
    });

    it("classifies secret management discussion as public_technical", () => {
      const result = classifyEvidenceSensitivity(
        "We should rotate secrets every 90 days for security.",
      );
      assert.strictEqual(result.sensitivityClass, "public_technical");
    });

    it("classifies credential vocabulary as public_technical", () => {
      const result = classifyEvidenceSensitivity(
        "The credential type is OAuth2 with PKCE.",
      );
      assert.strictEqual(result.sensitivityClass, "public_technical");
    });
  });

  describe("sensitive classification", () => {
    it("classifies Bearer token leak as sensitive", () => {
      const result = classifyEvidenceSensitivity(
        "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
      );
      assert.strictEqual(result.sensitivityClass, "sensitive");
      assert.strictEqual(result.reason, "credential_shape_detected");
      assert.ok(result.confidence >= 0.9);
    });

    it("classifies assignment-like secret as sensitive", () => {
      const result = classifyEvidenceSensitivity(
        "api_key = 'sk-abc123def456ghi789jkl012mno345pqr'",
      );
      assert.strictEqual(result.sensitivityClass, "sensitive");
    });

    it("classifies private key header as sensitive", () => {
      const result = classifyEvidenceSensitivity(
        "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...",
      );
      assert.strictEqual(result.sensitivityClass, "sensitive");
    });

    it("classifies high-entropy value as sensitive", () => {
      const result = classifyEvidenceSensitivity(
        "password = 'xK9mP2vL5nQ8wR4abc123def456ghi'",
      );
      assert.strictEqual(result.sensitivityClass, "sensitive");
    });
  });

  describe("private_context classification", () => {
    it("classifies DM as private_context", () => {
      const result = classifyEvidenceSensitivity(
        "DM: Can we talk about this privately?",
      );
      assert.strictEqual(result.sensitivityClass, "private_context");
      assert.strictEqual(result.reason, "private_context_detected");
    });

    it("classifies confidential marker as private_context", () => {
      const result = classifyEvidenceSensitivity(
        "This is confidential and internal only.",
      );
      assert.strictEqual(result.sensitivityClass, "private_context");
    });

    it("respects sourceContext private markers", () => {
      const result = classifyEvidenceSensitivity(
        "Hello world",
        "private message channel",
      );
      assert.strictEqual(result.sensitivityClass, "private_context");
    });
  });

  describe("public_general classification", () => {
    it("classifies general text as public_general", () => {
      const result = classifyEvidenceSensitivity(
        "Hello world, this is a normal post about cats.",
      );
      assert.strictEqual(result.sensitivityClass, "public_general");
      assert.strictEqual(result.reason, "no_distinctive_signals");
    });

    it("classifies empty text as public_general with low confidence", () => {
      const result = classifyEvidenceSensitivity("");
      assert.strictEqual(result.sensitivityClass, "public_general");
      assert.ok(result.confidence < 0.3);
      assert.ok(result.flags.includes("classification_low_confidence"));
    });
  });

  describe("batch classification", () => {
    it("classifies mixed batch correctly", () => {
      const texts = [
        "The token is used for auth.",
        "api_key = 'sk-abc123def456ghi789jkl012mno345'",
        "Hello world",
        "DM: private talk",
      ];
      const result = classifyEvidenceBatch(texts);
      assert.strictEqual(result.publicTechnicalCount, 1);
      assert.strictEqual(result.sensitiveCount, 1);
      assert.strictEqual(result.publicGeneralCount, 1);
      assert.strictEqual(result.privateCount, 1);
      assert.strictEqual(result.classifications.length, 4);
    });
  });
});
