import type { GuardBlock, ExpressionBoundaryBlock, GuidanceSceneType } from "./types.js";

export type OutputGuardConstraintId =
  | "avoid_customer_service_tone"
  | "avoid_daily_report_tone"
  | "avoid_teaching_template_tone"
  | "avoid_fabricated_experience"
  | "avoid_repetitive_phrasing";

export interface OutputGuardDefinition {
  sceneType: GuidanceSceneType;
  constraints: OutputGuardConstraintId[];
  hardGuardPriority: true;
  note: "output_guard_only_shapes_expression";
}

const SHARED_CONSTRAINTS: readonly OutputGuardConstraintId[] = [
  "avoid_customer_service_tone",
  "avoid_daily_report_tone",
  "avoid_teaching_template_tone",
  "avoid_fabricated_experience",
  "avoid_repetitive_phrasing",
];

const SCENE_NOTES: Record<OutputGuardConstraintId, string> = {
  avoid_customer_service_tone: "不要把自己说成客服或通知系统。",
  avoid_daily_report_tone: "不要把表达压扁成日报、周报或例行播报。",
  avoid_teaching_template_tone: "不要把表达写成教程、步骤说明或培训手册。",
  avoid_fabricated_experience: "不要虚构经历、关系、情绪事件或未发生的观察。",
  avoid_repetitive_phrasing: "不要滑进高重复、硬模板化或近似复读的措辞。",
};

/** @deprecated Use buildExpressionBoundary for new code. Kept for backward compatibility. */
export function buildOutputGuard(sceneType: GuidanceSceneType): GuardBlock {
  return {
    kind: "output_guard",
    constraints: SHARED_CONSTRAINTS.map((constraint) => SCENE_NOTES[constraint]),
    hardGuardPriority: true,
    _semanticNote: "output_guard_only_shapes_expression",
  };
}

export function getOutputGuardDefinition(sceneType: GuidanceSceneType): OutputGuardDefinition {
  return {
    sceneType,
    constraints: [...SHARED_CONSTRAINTS],
    hardGuardPriority: true,
    note: "output_guard_only_shapes_expression",
  };
}

// ─── T-V7C.C.7: Expression Boundary (new semantic layer) ─────────────────────

export type ExpressionConstraintId =
  | "avoid_customer_service_tone"
  | "avoid_daily_report_tone"
  | "avoid_teaching_template_tone"
  | "avoid_fabricated_experience"
  | "avoid_repetitive_phrasing";

const EXPRESSION_CONSTRAINTS: readonly ExpressionConstraintId[] = [
  "avoid_customer_service_tone",
  "avoid_daily_report_tone",
  "avoid_teaching_template_tone",
  "avoid_fabricated_experience",
  "avoid_repetitive_phrasing",
];

const EXPRESSION_NOTES: Record<ExpressionConstraintId, string> = {
  avoid_customer_service_tone: "避免客服腔或通知系统语气。",
  avoid_daily_report_tone: "避免日报、周报或例行播报腔。",
  avoid_teaching_template_tone: "避免教程、步骤说明或培训手册腔。",
  avoid_fabricated_experience: "避免虚构经历、关系、情绪事件或未发生的观察。",
  avoid_repetitive_phrasing: "避免高重复、硬模板化或近似复读的措辞。",
};

export function buildExpressionBoundary(_sceneType: GuidanceSceneType): ExpressionBoundaryBlock {
  return {
    kind: "expression_boundary",
    constraints: EXPRESSION_CONSTRAINTS.map((c) => EXPRESSION_NOTES[c]),
    style: "avoid_prefer",
    ownership: "behavioral_guidance_system",
  };
}
