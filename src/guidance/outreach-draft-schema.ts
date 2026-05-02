/**
 * Outreach draft request contracts + zod validation (T6.1.1 / behavioral-guidance-system v5).
 *
 * Core logic: strict schema for control-plane → guidance handoff; GuidanceDraftPort documents async seam.
 * Test coverage: tests/unit/guidance/outreach-draft-schema.test.ts
 */
import { z } from "zod";

const sourceRefKindSchema = z.enum([
  "platform_item",
  "workspace_artifact",
  "decision_record",
  "user_anchor",
  "connector_result",
  "host_report",
  "fallback_artifact",
]);

export const guidanceSourceRefSchema = z.object({
  id: z.string().min(1),
  kind: sourceRefKindSchema,
  uri: z.string().min(1),
  excerptHash: z.string().optional(),
  observedAt: z.string().optional(),
});

export type GuidanceSourceRef = z.infer<typeof guidanceSourceRefSchema>;

export const deliveryExpressionContextSchema = z.object({
  deliveryVerdict: z.enum([
    "target_available",
    "target_none",
    "channel_missing",
    "host_unsupported",
    "delivery_failed",
  ]),
  fallbackRef: z.string().optional(),
  wordingMode: z.enum(["sendable", "not_sent_fallback_candidate"]),
});

const guidanceSceneTypeSchema = z.enum([
  "outreach",
  "quiet_reflection",
  "social",
  "explain",
  "user_reply_continuity",
  "fallback_candidate",
]);

const runtimeScopeSchema = z.enum(["rhythm", "user_task", "user_reply"]);

const riskLevelSchema = z.enum(["low", "medium", "high"]);

export const sceneGuidanceRequestSchema = z.object({
  requestId: z.string().min(1),
  sceneType: guidanceSceneTypeSchema,
  runtimeScope: runtimeScopeSchema,
  rhythmWindowKind: z
    .enum(["work", "exploration", "social", "quiet", "reflection", "maintenance"])
    .optional(),
  riskLevel: riskLevelSchema,
  sourceRefs: z.array(guidanceSourceRefSchema),
  deliveryContext: deliveryExpressionContextSchema.optional(),
  language: z.enum(["zh-CN", "en-US"]).optional(),
});

export const outreachDraftRequestSchema = sceneGuidanceRequestSchema
  .extend({
    sceneType: z.enum(["outreach", "fallback_candidate"]),
    decisionId: z.string().min(1),
    candidateId: z.string().min(1),
    judgmentVerdict: z.enum(["allow", "deny", "defer"]),
    valueScore: z.number(),
    interestRefs: z.array(guidanceSourceRefSchema),
  })
  .superRefine((val, ctx) => {
    if (!val.deliveryContext) {
      ctx.addIssue({
        code: "custom",
        message: "outreach_draft_requires_delivery_context",
        path: ["deliveryContext"],
      });
    }
  });

export type SceneGuidanceRequest = z.infer<typeof sceneGuidanceRequestSchema>;
export type OutreachDraftRequest = z.infer<typeof outreachDraftRequestSchema>;
export type DeliveryExpressionContext = z.infer<typeof deliveryExpressionContextSchema>;

export function parseOutreachDraftRequest(input: unknown): OutreachDraftRequest {
  return outreachDraftRequestSchema.parse(input);
}

export function safeParseOutreachDraftRequest(input: unknown) {
  return outreachDraftRequestSchema.safeParse(input);
}

/** Async seam for generative outreach copy (implementation lives outside control-plane). */
export interface GuidanceDraftPort {
  draftOutreachMessage(request: OutreachDraftRequest): Promise<
    | { status: "ready"; draft: { text: string; deliveryWording: DeliveryExpressionContext["wordingMode"] } }
    | { status: "unavailable"; reasons: string[] }
  >;
}
