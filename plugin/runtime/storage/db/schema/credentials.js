import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const credentialRecords = sqliteTable("credential_records", {
    platformId: text("platform_id").primaryKey(),
    credentialType: text("credential_type").notNull(),
    encryptedValue: text("encrypted_value").notNull(),
    status: text("status").notNull(),
    verificationCode: text("verification_code"),
    challengeText: text("challenge_text"),
    expiresAt: text("expires_at"),
    attemptsRemaining: integer("attempts_remaining"),
    updatedAt: text("updated_at").notNull(),
});
