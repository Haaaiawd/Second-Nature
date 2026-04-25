import type { GuardBlock, GuidanceSceneType } from "./types.js";
export type OutputGuardConstraintId = "avoid_customer_service_tone" | "avoid_daily_report_tone" | "avoid_teaching_template_tone" | "avoid_fabricated_experience" | "avoid_repetitive_phrasing";
export interface OutputGuardDefinition {
    sceneType: GuidanceSceneType;
    constraints: OutputGuardConstraintId[];
    hardGuardPriority: true;
    note: "output_guard_only_shapes_expression";
}
export declare function buildOutputGuard(sceneType: GuidanceSceneType): GuardBlock;
export declare function getOutputGuardDefinition(sceneType: GuidanceSceneType): OutputGuardDefinition;
