/**
 * Tests for RuntimeSecretAnchorView — T-OBS.C.7
 *
 * Verification plan §t-obs-c-7:
 *   1. wrong key → status=wrong_key, reasonCode=credential_recovery_required, recoverySteps populated
 *   2. new workspace (no key anchor) → status=missing, reasonCode=runtime_secret_anchor_missing
 *   3. key exists + decrypt ok → status=verified, no reasonCode
 *   4. decrypt throws → status=decryption_failed, reasonCode=runtime_secret_unavailable
 *   5. decrypt returns error status → status=decryption_failed, reasonCode=runtime_secret_unavailable
 *   6. return value NEVER contains plaintext key fields (field enumeration check — ADR-007)
 *   7. checkedCredentialIds present and NOT containing key values (structural check)
 *   8. recoverySteps is non-empty array when status ≠ verified
 *   9. recoverySteps is empty array when status = verified
 *  10. keyPath echoes port value (path only, not value)
 *  11. lastCheckedAt uses injected now()
 *  12. checkKeyPathExists throws → treated as missing
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  viewSecretAnchor,
  type SecretAnchorDeps,
  type SampleDecryptResult,
} from "../../../src/observability/services/runtime-secret-anchor-view.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FIXED_NOW = "2026-05-01T00:00:00.000Z";
const FAKE_KEY_PATH = "SECOND_NATURE_ENCRYPTION_KEY";

function makeDeps(opts: {
  keyExists: boolean;
  sampleDecrypt?: SampleDecryptResult | (() => never);
  keyPathThrows?: boolean;
}): SecretAnchorDeps {
  return {
    runtimeOpsPort: {
      getEncryptionKeyPath: () => FAKE_KEY_PATH,
      checkKeyPathExists: async () => {
        if (opts.keyPathThrows) throw new Error("checkKeyPathExists_failed");
        return opts.keyExists;
      },
    },
    credentialPort: {
      verifySampleDecrypt: async () => {
        if (!opts.sampleDecrypt) {
          return { status: "ok" as const, checkedIds: ["cred-1"] };
        }
        if (typeof opts.sampleDecrypt === "function") {
          return opts.sampleDecrypt();
        }
        return opts.sampleDecrypt;
      },
    },
    now: () => FIXED_NOW,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("viewSecretAnchor — happy path", () => {
  it("key exists + decrypt ok → status=verified, no reasonCode", async () => {
    const deps = makeDeps({
      keyExists: true,
      sampleDecrypt: { status: "ok", checkedIds: ["cred-1", "cred-2"] },
    });
    const view = await viewSecretAnchor(deps);

    assert.equal(view.status, "verified");
    assert.equal(view.reasonCode, undefined);
    assert.deepEqual(view.checkedCredentialIds, ["cred-1", "cred-2"]);
    assert.deepEqual(view.recoverySteps, []);
  });
});

describe("viewSecretAnchor — missing key scenarios", () => {
  it("keyExists=false → status=missing, reasonCode=runtime_secret_anchor_missing", async () => {
    const deps = makeDeps({ keyExists: false });
    const view = await viewSecretAnchor(deps);

    assert.equal(view.status, "missing");
    assert.equal(view.reasonCode, "runtime_secret_anchor_missing");
    assert.ok(view.recoverySteps.length > 0, "should have recovery steps");
    // recoverySteps should guide setting the env var
    const actions = view.recoverySteps.map((s) => s.action).join(" ");
    assert.ok(
      actions.toLowerCase().includes("key") ||
        actions.toLowerCase().includes("environment") ||
        actions.toLowerCase().includes("bootstrap"),
      "recovery steps should mention key or environment setup"
    );
  });

  it("checkKeyPathExists throws → treated as missing", async () => {
    const deps = makeDeps({ keyExists: false, keyPathThrows: true });
    const view = await viewSecretAnchor(deps);

    assert.equal(view.status, "missing");
    assert.equal(view.reasonCode, "runtime_secret_anchor_missing");
  });
});

describe("viewSecretAnchor — wrong key", () => {
  it("wrong key → status=wrong_key, reasonCode=credential_recovery_required", async () => {
    const deps = makeDeps({
      keyExists: true,
      sampleDecrypt: { status: "wrong_key", checkedIds: ["cred-1"] },
    });
    const view = await viewSecretAnchor(deps);

    assert.equal(view.status, "wrong_key");
    assert.equal(view.reasonCode, "credential_recovery_required");
    assert.ok(view.recoverySteps.length > 0, "should have recovery steps");
    assert.deepEqual(view.checkedCredentialIds, ["cred-1"]);
  });
});

describe("viewSecretAnchor — unavailable / error scenarios", () => {
  it("verifySampleDecrypt throws → status=decryption_failed, reasonCode=runtime_secret_unavailable", async () => {
    const deps: SecretAnchorDeps = {
      runtimeOpsPort: {
        getEncryptionKeyPath: () => FAKE_KEY_PATH,
        checkKeyPathExists: async () => true,
      },
      credentialPort: {
        verifySampleDecrypt: async () => {
          throw new Error("decrypt_subsystem_crashed");
        },
      },
      now: () => FIXED_NOW,
    };
    const view = await viewSecretAnchor(deps);

    assert.equal(view.status, "decryption_failed");
    assert.equal(view.reasonCode, "runtime_secret_unavailable");
    assert.ok(view.recoverySteps.length > 0);
  });

  it("sampleDecrypt returns error status → status=decryption_failed, reasonCode=runtime_secret_unavailable", async () => {
    const deps = makeDeps({
      keyExists: true,
      sampleDecrypt: { status: "error", checkedIds: [] },
    });
    const view = await viewSecretAnchor(deps);

    assert.equal(view.status, "decryption_failed");
    assert.equal(view.reasonCode, "runtime_secret_unavailable");
  });
});

describe("viewSecretAnchor — security invariants (ADR-007)", () => {
  const FORBIDDEN_FIELD_NAMES = [
    "key",
    "secret",
    "token",
    "password",
    "value",
    "plaintext",
    "keyValue",
    "rawKey",
    "encryptionKey",
    "keyMaterial",
  ];

  it("return value NEVER contains plaintext key fields", async () => {
    const deps = makeDeps({
      keyExists: true,
      sampleDecrypt: { status: "ok", checkedIds: ["cred-1"] },
    });
    const view = await viewSecretAnchor(deps);

    // Enumerate all keys in the returned object — none should be forbidden field names
    const allKeys = Object.keys(view).map((k) => k.toLowerCase());
    for (const forbidden of FORBIDDEN_FIELD_NAMES) {
      assert.ok(
        !allKeys.includes(forbidden),
        `view must not contain field "${forbidden}"`
      );
    }
  });

  it("missing key view also has no forbidden fields", async () => {
    const deps = makeDeps({ keyExists: false });
    const view = await viewSecretAnchor(deps);

    const allKeys = Object.keys(view).map((k) => k.toLowerCase());
    for (const forbidden of FORBIDDEN_FIELD_NAMES) {
      assert.ok(
        !allKeys.includes(forbidden),
        `view must not contain field "${forbidden}"`
      );
    }
  });

  it("keyPath is the path string, not a value (structural check)", async () => {
    const deps = makeDeps({ keyExists: false });
    const view = await viewSecretAnchor(deps);

    // Should be the key path (env var name), which is short and does not look like a secret
    assert.equal(view.keyPath, FAKE_KEY_PATH);
    // Must not be a long random-looking string (like a real key)
    assert.ok(
      view.keyPath.length < 100,
      "keyPath should be a short env var name, not a long key value"
    );
  });
});

describe("viewSecretAnchor — recovery steps", () => {
  it("recoverySteps is non-empty when status is missing", async () => {
    const view = await viewSecretAnchor(makeDeps({ keyExists: false }));
    assert.ok(view.recoverySteps.length > 0);
    assert.ok(
      view.recoverySteps.every((s) => typeof s.step === "number" && typeof s.action === "string"),
      "each recovery step must have step number and action string"
    );
  });

  it("recoverySteps is non-empty when status is wrong_key", async () => {
    const view = await viewSecretAnchor(
      makeDeps({ keyExists: true, sampleDecrypt: { status: "wrong_key", checkedIds: [] } })
    );
    assert.ok(view.recoverySteps.length > 0);
  });

  it("recoverySteps is empty array when status is verified", async () => {
    const view = await viewSecretAnchor(
      makeDeps({ keyExists: true, sampleDecrypt: { status: "ok", checkedIds: ["c1"] } })
    );
    assert.deepEqual(view.recoverySteps, []);
  });

  it("recovery steps are ordered by step number", async () => {
    const view = await viewSecretAnchor(makeDeps({ keyExists: false }));
    const steps = view.recoverySteps;
    for (let i = 0; i < steps.length - 1; i++) {
      assert.ok(
        steps[i].step < steps[i + 1].step,
        "recovery steps should be in ascending step order"
      );
    }
  });
});

describe("viewSecretAnchor — metadata", () => {
  it("uses injected now() for lastCheckedAt", async () => {
    const deps = makeDeps({ keyExists: false });
    const view = await viewSecretAnchor(deps);
    assert.equal(view.lastCheckedAt, FIXED_NOW);
  });

  it("keyPath matches value returned by getEncryptionKeyPath()", async () => {
    const deps = makeDeps({ keyExists: true });
    const view = await viewSecretAnchor(deps);
    assert.equal(view.keyPath, FAKE_KEY_PATH);
  });

  it("recoveryDocRef is always set", async () => {
    const view1 = await viewSecretAnchor(makeDeps({ keyExists: false }));
    const view2 = await viewSecretAnchor(
      makeDeps({ keyExists: true, sampleDecrypt: { status: "ok", checkedIds: [] } })
    );
    assert.ok(view1.recoveryDocRef.length > 0);
    assert.ok(view2.recoveryDocRef.length > 0);
  });

  it("anchorId is always 'primary'", async () => {
    const view = await viewSecretAnchor(makeDeps({ keyExists: false }));
    assert.equal(view.anchorId, "primary");
  });
});
