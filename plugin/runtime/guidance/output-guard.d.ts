import type { GuardBlock, ExpressionBoundaryBlock, GuidanceSceneType } from "./types.js";
export type OutputGuardConstraintId = "avoid_customer_service_tone" | "avoid_daily_report_tone" | "avoid_teaching_template_tone" | "avoid_fabricated_experience" | "avoid_repetitive_phrasing";
export interface OutputGuardDefinition {
    sceneType: GuidanceSceneType;
    constraints: OutputGuardConstraintId[];
    hardGuardPriority: true;
    note: "output_guard_only_shapes_expression";
}
/** @deprecated Use buildExpressionBoundary for new code. Kept for backward compatibility. */
export declare function buildOutputGuard(sceneType: GuidanceSceneType): GuardBlock;
export declare function getOutputGuardDefinition(sceneType: GuidanceSceneType): OutputGuardDefinition;
export type ExpressionConstraintId = "avoid_customer_service_tone" | "avoid_daily_report_tone" | "avoid_teaching_template_tone" | "avoid_fabricated_experience" | "avoid_repetitive_phrasing";
export declare function buildExpressionBoundary(_sceneType: GuidanceSceneType): ExpressionBoundaryBlock;
