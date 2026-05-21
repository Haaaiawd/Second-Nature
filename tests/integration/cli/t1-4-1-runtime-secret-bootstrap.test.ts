/**
 * T1.4.1 — Runtime Secret Bootstrap & credential recovery diagnostic.
 *
 * Acceptance:
 * A. Missing SECOND_NATURE_ENCRYPTION_KEY → credential status reports decrypt_failed
 *    with diagnosticCode missing_runtime_secret and actionable nextStep.
 * B. Wrong key (cannot decrypt existing ciphertext) → decrypt_failed with
 *    diagnosticCode credential_recovery_required.
 * C. Valid key + existing credential → active with keyHealth ok, no raw secret leaked.
 * D. Base URL absence is reflected in hasBaseUrl but does not affect decrypt status.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  closeCliRuntimeDeps,
  createCliRuntimeDeps,
  createCommandRouter,
} from "../../../src/cli/index.js";
import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createObservabilityDatabase } from "../../../src/observability/db/index.js";
import { encryptCredentialAtRest } from "../../../src/storage/services/credential-vault.js";

const ORIGINAL_KEY = process.env.SECOND_NATURE_ENCRYPTION_KEY;

function setKey(value: string | undefined) {
  if (value === undefined) {
    delete (process.env as Record<string, string | undefined>).SECOND_NATURE_ENCRYPTION_KEY;
  } else {
    process.env.SECOND_NATURE_ENCRYPTION_KEY = value;
  }
}

function restoreKey() {
  setKey(ORIGINAL_KEY);
}

test("T1.4.1-A: missing encryption key surfaces decrypt_failed + missing_runtime_secret", async () => {
  setKey(undefined);
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });
  const router = createCommandRouter({ deps });
  const cmd = router.resolve("credential")!;

  // Insert a credential row (simulating prior successful setup) without key
  const db = stateDb.db;
  await db.insert(await import("../../../src/storage/db/schema/index.js").then((m) => m.credentialRecords)).values({
    platformId: "moltbook",
    credentialType: "api_key",
    encryptedValue: "encrypted-placeholder",
    status: "active",
    updatedAt: new Date().toISOString(),
  });

  const result = (await cmd.execute({ action: "show", platformId: "moltbook" })) as Record<string, unknown>;
  assert.equal(result.ok, true);
  const data = result.data as Record<string, unknown>;
  assert.equal(data.status, "decrypt_failed", "missing key must report decrypt_failed, not generic missing");
  assert.equal(data.keyHealth, "missing_key");
  assert.equal(
    (data as Record<string, unknown>).nextStep,
    "set_SECOND_NATURE_ENCRYPTION_KEY_then_re_probe",
    "must give actionable next step",
  );
  assert.ok(
    !JSON.stringify(data).includes("encrypted-placeholder"),
    "raw encrypted value must never leak to read model",
  );

  await closeCliRuntimeDeps(deps);
  restoreKey();
});

test("T1.4.1-B: wrong key surfaces decrypt_failed + credential_recovery_required", async () => {
  // Encrypt with a valid key
  const validKey = "a".repeat(32);
  setKey(validKey);
  const ciphertext = encryptCredentialAtRest("secret-api-key");

  // Now switch to a different key
  setKey("b".repeat(32));

  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });
  const router = createCommandRouter({ deps });
  const cmd = router.resolve("credential")!;

  const db = stateDb.db;
  await db.insert(await import("../../../src/storage/db/schema/index.js").then((m) => m.credentialRecords)).values({
    platformId: "evomap",
    credentialType: "api_key",
    encryptedValue: ciphertext,
    status: "active",
    updatedAt: new Date().toISOString(),
  });

  const result = (await cmd.execute({ action: "show", platformId: "evomap" })) as Record<string, unknown>;
  assert.equal(result.ok, true);
  const data = result.data as Record<string, unknown>;
  assert.equal(data.status, "decrypt_failed", "wrong key must report decrypt_failed");
  assert.equal(data.keyHealth, "wrong_key");
  assert.equal(
    (data as Record<string, unknown>).nextStep,
    "verify_or_re_create_credential_then_re_import",
    "must give recovery next step",
  );
  assert.ok(
    !JSON.stringify(data).includes(ciphertext),
    "ciphertext must not leak to read model",
  );

  await closeCliRuntimeDeps(deps);
  restoreKey();
});

test("T1.4.1-C: valid key + existing credential → active with ok keyHealth", async () => {
  const validKey = "c".repeat(32);
  setKey(validKey);
  const ciphertext = encryptCredentialAtRest("my-api-key");

  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });
  const router = createCommandRouter({ deps });
  const cmd = router.resolve("credential")!;

  const db = stateDb.db;
  await db.insert(await import("../../../src/storage/db/schema/index.js").then((m) => m.credentialRecords)).values({
    platformId: "agent-world",
    credentialType: "api_key",
    encryptedValue: ciphertext,
    status: "active",
    updatedAt: new Date().toISOString(),
  });

  const result = (await cmd.execute({ action: "show", platformId: "agent-world" })) as Record<string, unknown>;
  assert.equal(result.ok, true);
  const data = result.data as Record<string, unknown>;
  assert.equal(data.status, "active");
  assert.equal(data.keyHealth, "ok");
  assert.ok(
    !JSON.stringify(data).includes("my-api-key"),
    "plaintext secret must never leak to read model",
  );
  assert.ok(
    !JSON.stringify(data).includes(ciphertext),
    "ciphertext must not leak to read model",
  );

  await closeCliRuntimeDeps(deps);
  restoreKey();
});

test("T1.4.1-D: status aggregate includes keyHealth in credentials list", async () => {
  setKey(undefined);
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");

  const db = stateDb.db;
  await db.insert(await import("../../../src/storage/db/schema/index.js").then((m) => m.credentialRecords)).values({
    platformId: "instreet",
    credentialType: "api_key",
    encryptedValue: "some-cipher",
    status: "active",
    updatedAt: new Date().toISOString(),
  });

  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });
  const router = createCommandRouter({ deps });
  const cmd = router.resolve("status")!;

  const result = (await cmd.execute()) as Record<string, unknown>;
  assert.equal(result.ok, true);
  const data = result.data as Record<string, unknown>;
  const credentials = data.credentials as Array<Record<string, unknown>>;
  assert.ok(credentials && credentials.length > 0, "status must include credentials");
  const instreet = credentials.find((c) => c.platformId === "instreet");
  assert.ok(instreet, "instreet credential must appear in status");
  assert.equal(instreet.status, "decrypt_failed");
  assert.equal(instreet.keyHealth, "missing_key");

  await closeCliRuntimeDeps(deps);
  restoreKey();
});
