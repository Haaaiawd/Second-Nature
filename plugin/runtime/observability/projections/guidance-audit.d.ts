import type { GuidancePayload, GuidanceUnavailable, SceneContext } from "../../guidance/types.js";
export interface GuidanceParticipationAudit {
    id: string;
    sceneContext: SceneContext;
    payload: GuidancePayload | GuidanceUnavailable;
    usedFallback: boolean;
}
export interface GuidanceParticipationProjection {
    eventId: string;
    sceneType: SceneContext["sceneType"];
    usedFallback: boolean;
    guidanceAvailable: boolean;
    blockSummary: string[];
    snippetRationales: string[];
}
export declare function projectGuidanceParticipationAudit(input: GuidanceParticipationAudit): GuidanceParticipationProjection;
