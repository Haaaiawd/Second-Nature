/**
 * IdentityProfileStore — T-SMS.C.4
 *
 * Core logic: Canonical identity + per-platform handles, no credential stored.
 * Missing platform returns degraded reason code, not blocking.
 *
 * Dependencies: StateDatabase, identity_profile table (v7-001 migration)
 */

import { eq } from "drizzle-orm";
import type { StateDatabase } from "../db/index.js";
import type { IdentityProfile, PlatformHandle } from "../../shared/types/v7-entities.js";

export interface IdentityProfileStore {
  upsertIdentityProfile(profile: IdentityProfile): Promise<void>;
  loadIdentityProfile(profileId: string): Promise<
    | { status: "loaded"; profile: IdentityProfile }
    | { status: "degraded"; profile: IdentityProfile; missingPlatforms: string[] }
    | { status: "not_found"; reason: string }
  >;
}

function safeParseJson<T>(json: string, fallback: T): T {
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

export function createIdentityProfileStore(database: StateDatabase): IdentityProfileStore {
  const { sqlite } = database;

  return {
    async upsertIdentityProfile(profile: IdentityProfile) {
      const existing = sqlite.exec(
        `SELECT 1 FROM identity_profile WHERE profile_id = '${profile.profileId}'`,
      );
      const hasRow = existing.length > 0 && existing[0]!.values.length > 0;

      const sql = hasRow
        ? `UPDATE identity_profile SET
             canonical_name = ?, canonical_avatar = ?, canonical_bio = ?,
             platform_handles_json = ?, updated_at = ?
           WHERE profile_id = ?`
        : `INSERT INTO identity_profile
             (profile_id, canonical_name, canonical_avatar, canonical_bio,
              platform_handles_json, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`;

      const params = hasRow
        ? [
            profile.canonicalName,
            profile.canonicalAvatar ?? null,
            profile.canonicalBio ?? null,
            JSON.stringify(profile.platformHandles),
            profile.updatedAt,
            profile.profileId,
          ]
        : [
            profile.profileId,
            profile.canonicalName,
            profile.canonicalAvatar ?? null,
            profile.canonicalBio ?? null,
            JSON.stringify(profile.platformHandles),
            profile.updatedAt,
          ];

      sqlite.run(sql, params);
    },

    async loadIdentityProfile(profileId: string) {
      const result = sqlite.exec(
        `SELECT * FROM identity_profile WHERE profile_id = '${profileId}' LIMIT 1`,
      );

      if (result.length === 0 || result[0]!.values.length === 0) {
        return { status: "not_found" as const, reason: "identity_profile_missing" };
      }

      const cols = result[0]!.columns;
      const vals = result[0]!.values[0]!;
      const get = (name: string) => vals[cols.indexOf(name)] as string | null | undefined;

      const handles = safeParseJson<PlatformHandle[]>(get("platform_handles_json") ?? "[]", []);

      const profile: IdentityProfile = {
        profileId: get("profile_id")!,
        canonicalName: get("canonical_name")!,
        canonicalAvatar: get("canonical_avatar") ?? undefined,
        canonicalBio: get("canonical_bio") ?? undefined,
        platformHandles: handles,
        updatedAt: get("updated_at")!,
      };

      // ADR-007: degraded if any expected platform missing
      const expectedPlatforms = ["moltbook", "agent_world", "instreet"];
      const missing = expectedPlatforms.filter(
        (p) => !handles.some((h) => h.platformId === p),
      );

      if (missing.length > 0) {
        return {
          status: "degraded" as const,
          profile,
          missingPlatforms: missing,
        };
      }

      return { status: "loaded" as const, profile };
    },
  };
}
