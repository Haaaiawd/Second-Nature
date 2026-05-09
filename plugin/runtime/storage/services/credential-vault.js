/**
 * Credential encryption at rest (AES-256-GCM).
 *
 * Key material: `SECOND_NATURE_ENCRYPTION_KEY` (UTF-8, first 32 bytes used). Lazy read so tests can set env before first encrypt.
 * Test coverage: tests/integration/cli/cli-ops-surface.test.ts (credential save path via state-api).
 */
import * as crypto from "crypto";
import { eq } from "drizzle-orm";
import { credentialRecords } from "../db/schema/index.js";
const ALGORITHM = "aes-256-gcm";
function resolveKeyBuffer() {
    const raw = process.env.SECOND_NATURE_ENCRYPTION_KEY?.trim();
    if (!raw || raw.length < 32) {
        throw new Error("SECOND_NATURE_ENCRYPTION_KEY is required for credential encryption at rest (min 32 UTF-8 characters)");
    }
    return Buffer.from(raw.slice(0, 32), "utf8");
}
function encryptInternal(plaintext) {
    const iv = crypto.randomBytes(16);
    const key = resolveKeyBuffer();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted.toString("hex");
}
function decryptInternal(ciphertext) {
    const parts = ciphertext.split(":");
    if (parts.length !== 3) {
        throw new Error("credential_ciphertext_invalid_format");
    }
    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const encrypted = Buffer.from(parts[2], "hex");
    const key = resolveKeyBuffer();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final("utf8");
}
/** Three colon-separated hex segments produced by `encryptCredentialAtRest`. */
export function isCredentialCiphertext(value) {
    const parts = value.split(":");
    if (parts.length !== 3)
        return false;
    return parts.every((p) => /^[0-9a-f]+$/i.test(p));
}
/** Encrypts non-empty plaintext; empty string returns empty. */
export function encryptCredentialAtRest(plaintext) {
    if (!plaintext)
        return "";
    return encryptInternal(plaintext);
}
export function decryptCredentialAtRest(ciphertext) {
    if (!ciphertext)
        return "";
    return decryptInternal(ciphertext);
}
export function createCredentialVault(db) {
    return {
        async saveCredentialContext(input) {
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
        async loadCredentialContext(platformId) {
            const record = await db.query.credentialRecords.findFirst({
                where: (tbl) => eq(tbl.platformId, platformId),
            });
            if (!record)
                return null;
            let plain;
            if (record.encryptedValue) {
                if (!isCredentialCiphertext(record.encryptedValue)) {
                    throw new Error("credential_store_plaintext_or_invalid_legacy_record");
                }
                plain = decryptCredentialAtRest(record.encryptedValue);
            }
            return {
                platformId: record.platformId,
                credentialType: record.credentialType,
                status: record.status,
                encryptedValue: plain,
                verificationCode: record.verificationCode ?? undefined,
                challengeText: record.challengeText ?? undefined,
                verificationDeadline: record.expiresAt ?? undefined,
                attemptsRemaining: record.attemptsRemaining ?? undefined,
            };
        },
        async getCredentialState(platformId) {
            const record = await db.query.credentialRecords.findFirst({
                where: (tbl) => eq(tbl.platformId, platformId),
            });
            return record?.status || "missing";
        },
    };
}
