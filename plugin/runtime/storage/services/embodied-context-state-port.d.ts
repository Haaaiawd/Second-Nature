/**
 * EmbodiedContextStatePort — T-SMS.C.2
 *
 * Core logic: 5 read methods for assembling EmbodiedContext slices.
 * Each method supports bounded query (limit/window).
 * Affordance and self-health slices are sourced from body-tool-system
 * and observability-health-system respectively, NOT read directly here.
 * DR-011: loadAcceptedDreamProjection returns accepted projection only.
 * DR-013: bounded context, degraded reason codes on failure.
 * DR-024: empty accepted dream → context_degraded:dream_projection_unavailable.
 *
 * Dependencies:
 * - GoalLifecycleStore from `./goal-lifecycle-store.js`
 * - IdentityProfileStore from `./identity-profile-store.js`
 * - InteractionSnapshotProjector from `./interaction-snapshot-projector.js`
 * - ToolExperienceStore from `./tool-experience-store.js`
 * - dream_output_index table (v7-001 migration)
 *
 * Boundary:
 * - This port ONLY reads state-memory tables.
 * - Affordance map and self-health are injected by caller (control-plane)
 *   from their respective systems.
 * - All methods return empty array + reason on missing data, never throw.
 */
import type { IdentityProfile, RecentInteractionSnapshot, ToolExperience, DreamOutput } from "../../shared/types/v7-entities.js";
import type { AgentGoal } from "../../shared/types/goal.js";
import type { GoalLifecycleStore } from "./goal-lifecycle-store.js";
import type { IdentityProfileStore } from "./identity-profile-store.js";
import type { InteractionSnapshotProjector } from "./interaction-snapshot-projector.js";
import type { ToolExperienceStore } from "./tool-experience-store.js";
import type { StateDatabase } from "../db/index.js";
export interface EmbodiedContextStatePort {
    loadIdentityProfile(profileId: string): Promise<{
        status: "loaded";
        data: IdentityProfile;
    } | {
        status: "degraded";
        data?: IdentityProfile;
        reason: string;
    }>;
    listActiveGoals(limit?: number): Promise<{
        status: "loaded";
        data: AgentGoal[];
    } | {
        status: "degraded";
        reason: string;
    }>;
    loadRecentInteractionSnapshot(limit?: number): Promise<{
        status: "loaded";
        data: RecentInteractionSnapshot[];
    } | {
        status: "degraded";
        reason: string;
    }>;
    loadToolExperienceSlice(limit?: number): Promise<{
        status: "loaded";
        data: ToolExperience[];
    } | {
        status: "degraded";
        reason: string;
    }>;
    loadAcceptedDreamProjection(limit?: number): Promise<{
        status: "loaded";
        data: DreamOutput[];
    } | {
        status: "degraded";
        reason: string;
    }>;
}
export interface EmbodiedContextStatePortDeps {
    database: StateDatabase;
    goalStore: GoalLifecycleStore;
    identityStore: IdentityProfileStore;
    interactionProjector: InteractionSnapshotProjector;
    experienceStore: ToolExperienceStore;
}
export declare function createEmbodiedContextStatePort(deps: EmbodiedContextStatePortDeps): EmbodiedContextStatePort;
