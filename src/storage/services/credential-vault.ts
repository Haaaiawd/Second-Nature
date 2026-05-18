/**
 * Credential encryption at rest (AES-256-GCM).
 *
 * Key material: `SECOND_NATURE_ENCRYPTION_KEY` (UTF-8, first 32 bytes used). Lazy read so tests can set env before first encrypt.
 * Test coverage: tests/integration/cli/cli-ops-surface.test.ts (credential save path via state-api).
 */
import * as crypto from "crypto";
import { eq } from "drizzle-orm";
import type { StateDatabase } from "../db/index.js";
import type { CredentialContextWrite, CredentialContext, CredentialState, CredentialType } from "../../shared/types/index.js";
import { credentialRecords } from "../db/schema/index.js";

const ALGORITHM = "aes-256-gcm";

function resolveKeyBuffer(): Buffer {
  const raw = process.env.SECOND_NATURE_ENCRYPTION_KEY?.trim();
  if (!raw || raw.length < 32) {
    throw new Error(
      "SECOND_NATURE_ENCRYPTION_KEY is required for credential encryption at rest (min 32 UTF-8 characters)",
    );
  }
  return Buffer.from(raw.slice(0, 32), "utf8");
}

function encryptInternal(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const key = resolveKeyBuffer();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted.toString("hex");
}

function decryptInternal(ciphertext: string): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("credential_ciphertext_invalid_format");
  }
  const iv = Buffer.from(parts[0]!, "hex");
  const authTag = Buffer.from(parts[1]!, "hex");
  const encrypted = Buffer.from(parts[2]!, "hex");
  const key = resolveKeyBuffer();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

/** Three colon-separated hex segments produced by `encryptCredentialAtRest`. */
export function isCredentialCiphertext(value: string): boolean {
  const parts = value.split(":");
  if (parts.length !== 3) return false;
  return parts.every((p) => /^[0-9a-f]+$/i.test(p));
}

/** Encrypts non-empty plaintext; empty string returns empty. */
export function encryptCredentialAtRest(plaintext: string): string {
  if (!plaintext) return "";
  return encryptInternal(plaintext);
}

export function decryptCredentialAtRest(ciphertext: string): string {
  if (!ciphertext) return "";
  return decryptInternal(ciphertext);
}

export interface CredentialVault {
  saveCredentialContext(input: CredentialContextWrite): Promise<void>;
  loadCredentialContext(platformId: string): Promise<CredentialContext | null>;
  getCredentialState(platformId: string): Promise<CredentialState>;
}

/** T1.4.1 — runtime secret health probe result for a single credential row. */
export interface CredentialHealthProbe {
  platformId: string;
  state: CredentialState | "decrypt_failed";
  keyHealth: "missing_key" | "wrong_key" | "ok";
  hasBaseUrl: boolean;
  diagnosticCode: "missing_runtime_secret" | "credential_recovery_required" | "ok";
}

/**
 * T1.4.1 — probe a credential record for runtime secret health.
 *
 * Given a raw encrypted value from the DB, this function checks:
 * 1. Is SECOND_NATURE_ENCRYPTION_KEY present and >= 32 chars?
 * 2. Can the ciphertext be decrypted with that key?
 *
 * It never throws; all failures are encoded in the returned state.
 */
export function probeCredentialHealth(
  platformId: string,
  encryptedValue: string | undefined | null,
  baseUrl: string | undefined | null,
): CredentialHealthProbe {
  // Key availability check
  const rawKey = process.env.SECOND_NATURE_ENCRYPTION_KEY?.trim();
  if (!rawKey || rawKey.length < 32) {
    return {
      platformId,
      state: encryptedValue ? "decrypt_failed" : "missing",
      keyHealth: "missing_key",
      hasBaseUrl: Boolean(baseUrl),
      diagnosticCode: "missing_runtime_secret",
    };
  }

  // No encrypted value to test
  if (!encryptedValue) {
    return {
      platformId,
      state: "missing",
      keyHealth: "ok",
      hasBaseUrl: Boolean(baseUrl),
      diagnosticCode: "ok",
    };
  }

  // Decryption attempt
  try {
    decryptCredentialAtRest(encryptedValue);
    return {
      platformId,
      state: "active",
      keyHealth: "ok",
      hasBaseUrl: Boolean(baseUrl),
      diagnosticCode: "ok",
    };
  } catch {
    return {
      platformId,
      state: "decrypt_failed",
      keyHealth: "wrong_key",
      hasBaseUrl: Boolean(baseUrl),
      diagnosticCode: "credential_recovery_required",
    };
  }
}

export function createCredentialVault(db: StateDatabase["db"]): CredentialVault {
  return {
    async saveCredentialContext(input: CredentialContextWrite): Promise<void> {
      const encrypted = input.encryptedValue ? encryptCredentialAtRest(input.encryptedValue) : "";
      await db.insert(credentialRecords).values({
        platformId: input.platformId,
        credentialType: input.credentialType,
        encryptedValue: encrypted,
        status: input.status,
        verificationCode: input.verificationCode ?? null,
        challengeText: input.challengeText ?? null,
        expiresAt: input.expiresAt ?? null,
        attemptsRemaining: input.attemptsRemaining ?? null,
        updatedAt: new Date().toISOString(),
      }).onConflictDoUpdate({
        target: credentialRecords.platformId,
        set: {
          credentialType: input.credentialType,
          encryptedValue: encrypted,
          status: input.status,
          verificationCode: input.verificationCode ?? null,
          challengeText: input.challengeText ?? null,
          expiresAt: input.expiresAt ?? null,
          attemptsRemaining: input.attemptsRemaining ?? null,
          updatedAt: new Date().toISOString(),
        },
      });
    },

    async loadCredentialContext(platformId: string): Promise<CredentialContext | null> {
      const record = await db.query.credentialRecords.findFirst({
        where: (tbl) => eq(tbl.platformId, platformId),
      });
      if (!record) return null;

      let plain: string | undefined;
      if (record.encryptedValue) {
        if (!isCredentialCiphertext(record.encryptedValue)) {
          throw new Error("credential_store_plaintext_or_invalid_legacy_record");
        }
        plain = decryptCredentialAtRest(record.encryptedValue);
      }

      return {
        platformId: record.platformId,
        credentialType: record.credentialType as CredentialType,
        status: record.status as CredentialState,
        encryptedValue: plain,
        verificationCode: record.verificationCode ?? undefined,
        challengeText: record.challengeText ?? undefined,
        verificationDeadline: record.expiresAt ?? undefined,
        attemptsRemaining: record.attemptsRemaining ?? undefined,
      };
    },

    async getCredentialState(platformId: string): Promise<CredentialState> {
      const record = await db.query.credentialRecords.findFirst({
        where: (tbl) => eq(tbl.platformId, platformId),
      });
      return (record?.status as CredentialState) || "missing";
    },
  };
}
