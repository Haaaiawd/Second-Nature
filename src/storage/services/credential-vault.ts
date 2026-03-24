import * as crypto from "crypto";
import { eq } from "drizzle-orm";
import type { StateDatabase } from "../db/index.js";
import type { CredentialContextWrite, CredentialContext, CredentialState, CredentialType } from "../../shared/types/index.js";
import { credentialRecords } from "../db/schema/index.js";

const ENCRYPTION_KEY = process.env.SECOND_NATURE_ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");
const ALGORITHM = "aes-256-gcm";

function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32), "utf8");
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 3) return ciphertext;
  const iv = Buffer.from(parts[0], "hex");
  const authTag = Buffer.from(parts[1], "hex");
  const encrypted = Buffer.from(parts[2], "hex");
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32), "utf8");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

export interface CredentialVault {
  saveCredentialContext(input: CredentialContextWrite): Promise<void>;
  loadCredentialContext(platformId: string): Promise<CredentialContext | null>;
  getCredentialState(platformId: string): Promise<CredentialState>;
}

export function createCredentialVault(db: StateDatabase["db"]): CredentialVault {
  return {
    async saveCredentialContext(input: CredentialContextWrite): Promise<void> {
      const encrypted = input.encryptedValue ? encrypt(input.encryptedValue) : "";
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

      return {
        platformId: record.platformId,
        credentialType: record.credentialType as CredentialType,
        status: record.status as CredentialState,
        encryptedValue: record.encryptedValue ? decrypt(record.encryptedValue) : undefined,
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