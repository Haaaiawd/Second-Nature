/**
 * T1.4.1 — Credential health mapper unit tests.
 *
 * Covers probeCredentialHealth boundary behaviours:
 * - missing key + no encrypted value → missing / missing_key
 * - missing key + encrypted value → decrypt_failed / missing_key
 * - valid key + correct ciphertext → active / ok
 * - valid key + wrong ciphertext → decrypt_failed / wrong_key
 * - valid key + no encrypted value → missing / ok
 * - baseUrl presence tracking
 */
import test from "node:test";
import assert from "node:assert/strict";

import { probeCredentialHealth } from "../../../src/storage/services/credential-vault.js";
import { encryptCredentialAtRest } from "../../../src/storage/services/credential-vault.js";

const ORIGINAL_KEY = process.env.SECOND_NATURE_ENCRYPTION_KEY;

function setKey(key: string | undefined) {
  if (key === undefined) {
    delete process.env.SECOND_NATURE_ENCRYPTION_KEY;
  } else {
    process.env.SECOND_NATURE_ENCRYPTION_KEY = key;
  }
}

test.afterEach(() => {
  setKey(ORIGINAL_KEY);
});

test("T1.4.1-A: missing key + no encrypted value → missing / missing_key", () => {
  setKey(undefined);
  const probe = probeCredentialHealth("moltbook", undefined, "https://example.com");
  assert.equal(probe.state, "missing");
  assert.equal(probe.keyHealth, "missing_key");
  assert.equal(probe.diagnosticCode, "missing_runtime_secret");
  assert.equal(probe.hasBaseUrl, true);
});

test("T1.4.1-B: missing key + encrypted value → decrypt_failed / missing_key", () => {
  // Encrypt with a valid key first, then remove the key to simulate missing-key scenario.
  setKey("z".repeat(32));
  const encrypted = encryptCredentialAtRest("secret");
  setKey(undefined);
  const probe = probeCredentialHealth("moltbook", encrypted, undefined);
  assert.equal(probe.state, "decrypt_failed");
  assert.equal(probe.keyHealth, "missing_key");
  assert.equal(probe.diagnosticCode, "missing_runtime_secret");
  assert.equal(probe.hasBaseUrl, false);
});

test("T1.4.1-C: valid key + correct ciphertext → active / ok", () => {
  setKey("a".repeat(32));
  const encrypted = encryptCredentialAtRest("secret");
  const probe = probeCredentialHealth("moltbook", encrypted, "https://example.com");
  assert.equal(probe.state, "active");
  assert.equal(probe.keyHealth, "ok");
  assert.equal(probe.diagnosticCode, "ok");
  assert.equal(probe.hasBaseUrl, true);
});

test("T1.4.1-D: valid key + wrong ciphertext → decrypt_failed / wrong_key", () => {
  setKey("a".repeat(32));
  // Encrypt with one key, then change to another
  const encrypted = encryptCredentialAtRest("secret");
  setKey("b".repeat(32));
  const probe = probeCredentialHealth("moltbook", encrypted, "https://example.com");
  assert.equal(probe.state, "decrypt_failed");
  assert.equal(probe.keyHealth, "wrong_key");
  assert.equal(probe.diagnosticCode, "credential_recovery_required");
});

test("T1.4.1-E: valid key + no encrypted value → missing / ok", () => {
  setKey("a".repeat(32));
  const probe = probeCredentialHealth("moltbook", undefined, undefined);
  assert.equal(probe.state, "missing");
  assert.equal(probe.keyHealth, "ok");
  assert.equal(probe.diagnosticCode, "ok");
  assert.equal(probe.hasBaseUrl, false);
});

test("T1.4.1-F: baseUrl missing tracked independently", () => {
  setKey("a".repeat(32));
  const encrypted = encryptCredentialAtRest("secret");
  const probeWithBase = probeCredentialHealth("moltbook", encrypted, "https://example.com");
  const probeWithoutBase = probeCredentialHealth("moltbook", encrypted, undefined);
  assert.equal(probeWithBase.hasBaseUrl, true);
  assert.equal(probeWithoutBase.hasBaseUrl, false);
  assert.equal(probeWithBase.state, "active");
  assert.equal(probeWithoutBase.state, "active");
});
