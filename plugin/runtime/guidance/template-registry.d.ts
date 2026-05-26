import type { AtmosphereBlock, GuidanceSceneType, ImpulseBlock, ImpulseKind } from "./types.js";
type CoreSceneKind = Exclude<GuidanceSceneType, "explain" | "user_reply">;
export declare function getBaselineAtmosphereTemplate(): Pick<AtmosphereBlock, "kind" | "text" | "reviewStatus">;
export declare function getImpulseTemplate(sceneType: CoreSceneKind): ImpulseBlock;
/**
 * Get impulse template for capability-class-derived ImpulseKinds (explore / work).
 *
 * Returns null when:
 * - The kind has no registered text (pending_human_review state)
 * - The text is explicitly marked as pending review
 *
 * Callers (ImpulseAssembler) must fall back gracefully to intentKind impulse
 * or baseline atmosphere when null is returned.
 */
export declare function getCapabilityClassImpulseTemplate(kind: ImpulseKind): ImpulseBlock | null;
export {};
