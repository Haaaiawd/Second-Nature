import type { GuidancePayload, GuidanceUnavailable, PersonaCandidate, SceneContext } from "./types.js";
export type GuidanceOwnerId = "control-plane-system" | "behavioral-guidance-system" | "state-system" | "observability-system" | "hard-guard-layer";
export interface OwnerBoundary {
    owner: GuidanceOwnerId;
    owns: readonly string[];
    provides: readonly string[];
    mustNotOwn: readonly string[];
}
export interface GuidanceContracts {
    controlPlane: {
        requestGuidance(sceneContext: SceneContext): Promise<GuidancePayload | GuidanceUnavailable>;
    };
    guidance: {
        assembleGuidance(sceneContext: SceneContext): Promise<GuidancePayload | GuidanceUnavailable>;
    };
    state: {
        loadPersonaCandidates(sceneContext: SceneContext): Promise<PersonaCandidate[]>;
    };
    observability: {
        recordGuidanceParticipation(input: {
            sceneContext: SceneContext;
            payload: GuidancePayload | GuidanceUnavailable;
        }): Promise<void>;
    };
}
export declare const GUIDANCE_OWNER_BOUNDARIES: Record<GuidanceOwnerId, OwnerBoundary>;
export declare const GUIDANCE_HANDOFFS: {
    readonly request: {
        readonly from: "control-plane-system";
        readonly to: "behavioral-guidance-system";
        readonly payload: "scene_context";
    };
    readonly personaCandidates: {
        readonly from: "state-system";
        readonly to: "behavioral-guidance-system";
        readonly payload: "snippet_sized_persona_candidates";
    };
    readonly guidanceResult: {
        readonly from: "behavioral-guidance-system";
        readonly to: "control-plane-system";
        readonly payload: "guidance_payload_or_unavailable";
    };
    readonly auditRecord: {
        readonly from: "behavioral-guidance-system";
        readonly to: "observability-system";
        readonly payload: "guidance_participation_summary";
    };
};
