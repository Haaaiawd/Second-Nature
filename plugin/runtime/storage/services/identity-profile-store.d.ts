/**
 * IdentityProfileStore — T-SMS.C.4
 *
 * Core logic: Canonical identity + per-platform handles, no credential stored.
 * Missing platform returns degraded reason code, not blocking.
 *
 * Dependencies: StateDatabase, identity_profile table (v7-001 migration)
 */
import type { StateDatabase } from "../db/index.js";
import type { IdentityProfile } from "../../shared/types/v7-entities.js";
export interface IdentityProfileStore {
    upsertIdentityProfile(profile: IdentityProfile): Promise<void>;
    loadIdentityProfile(profileId: string): Promise<{
        status: "loaded";
        profile: IdentityProfile;
    } | {
        status: "degraded";
        profile: IdentityProfile;
        missingPlatforms: string[];
    } | {
        status: "not_found";
        reason: string;
    }>;
}
export declare function createIdentityProfileStore(database: StateDatabase): IdentityProfileStore;
