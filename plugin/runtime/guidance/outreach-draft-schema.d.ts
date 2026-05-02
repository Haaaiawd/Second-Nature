/**
 * Outreach draft request contracts + zod validation (T6.1.1 / behavioral-guidance-system v5).
 *
 * Core logic: strict schema for control-plane → guidance handoff; GuidanceDraftPort documents async seam.
 * Test coverage: tests/unit/guidance/outreach-draft-schema.test.ts
 */
import { z } from "zod";
export declare const guidanceSourceRefSchema: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<{
        platform_item: "platform_item";
        workspace_artifact: "workspace_artifact";
        decision_record: "decision_record";
        user_anchor: "user_anchor";
        connector_result: "connector_result";
        host_report: "host_report";
        fallback_artifact: "fallback_artifact";
    }>;
    uri: z.ZodString;
    excerptHash: z.ZodOptional<z.ZodString>;
    observedAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const deliveryExpressionContextSchema: z.ZodObject<{
    deliveryVerdict: z.ZodEnum<{
        target_none: "target_none";
        channel_missing: "channel_missing";
        host_unsupported: "host_unsupported";
        delivery_failed: "delivery_failed";
        target_available: "target_available";
    }>;
    fallbackRef: z.ZodOptional<z.ZodString>;
    wordingMode: z.ZodEnum<{
        sendable: "sendable";
        not_sent_fallback_candidate: "not_sent_fallback_candidate";
    }>;
}, z.core.$strip>;
export declare const sceneGuidanceRequestSchema: z.ZodObject<{
    requestId: z.ZodString;
    sceneType: z.ZodEnum<{
        outreach: "outreach";
        explain: "explain";
        social: "social";
        quiet_reflection: "quiet_reflection";
        user_reply_continuity: "user_reply_continuity";
        fallback_candidate: "fallback_candidate";
    }>;
    runtimeScope: z.ZodEnum<{
        rhythm: "rhythm";
        user_reply: "user_reply";
        user_task: "user_task";
    }>;
    rhythmWindowKind: z.ZodOptional<z.ZodEnum<{
        quiet: "quiet";
        social: "social";
        work: "work";
        exploration: "exploration";
        reflection: "reflection";
        maintenance: "maintenance";
    }>>;
    riskLevel: z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>;
    sourceRefs: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<{
            platform_item: "platform_item";
            workspace_artifact: "workspace_artifact";
            decision_record: "decision_record";
            user_anchor: "user_anchor";
            connector_result: "connector_result";
            host_report: "host_report";
            fallback_artifact: "fallback_artifact";
        }>;
        uri: z.ZodString;
        excerptHash: z.ZodOptional<z.ZodString>;
        observedAt: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    deliveryContext: z.ZodOptional<z.ZodObject<{
        deliveryVerdict: z.ZodEnum<{
            target_none: "target_none";
            channel_missing: "channel_missing";
            host_unsupported: "host_unsupported";
            delivery_failed: "delivery_failed";
            target_available: "target_available";
        }>;
        fallbackRef: z.ZodOptional<z.ZodString>;
        wordingMode: z.ZodEnum<{
            sendable: "sendable";
            not_sent_fallback_candidate: "not_sent_fallback_candidate";
        }>;
    }, z.core.$strip>>;
    language: z.ZodOptional<z.ZodEnum<{
        "en-US": "en-US";
        "zh-CN": "zh-CN";
    }>>;
}, z.core.$strip>;
export declare const outreachDraftRequestSchema: z.ZodObject<{
    requestId: z.ZodString;
    runtimeScope: z.ZodEnum<{
        rhythm: "rhythm";
        user_reply: "user_reply";
        user_task: "user_task";
    }>;
    rhythmWindowKind: z.ZodOptional<z.ZodEnum<{
        quiet: "quiet";
        social: "social";
        work: "work";
        exploration: "exploration";
        reflection: "reflection";
        maintenance: "maintenance";
    }>>;
    riskLevel: z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>;
    sourceRefs: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<{
            platform_item: "platform_item";
            workspace_artifact: "workspace_artifact";
            decision_record: "decision_record";
            user_anchor: "user_anchor";
            connector_result: "connector_result";
            host_report: "host_report";
            fallback_artifact: "fallback_artifact";
        }>;
        uri: z.ZodString;
        excerptHash: z.ZodOptional<z.ZodString>;
        observedAt: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    deliveryContext: z.ZodOptional<z.ZodObject<{
        deliveryVerdict: z.ZodEnum<{
            target_none: "target_none";
            channel_missing: "channel_missing";
            host_unsupported: "host_unsupported";
            delivery_failed: "delivery_failed";
            target_available: "target_available";
        }>;
        fallbackRef: z.ZodOptional<z.ZodString>;
        wordingMode: z.ZodEnum<{
            sendable: "sendable";
            not_sent_fallback_candidate: "not_sent_fallback_candidate";
        }>;
    }, z.core.$strip>>;
    language: z.ZodOptional<z.ZodEnum<{
        "en-US": "en-US";
        "zh-CN": "zh-CN";
    }>>;
    sceneType: z.ZodEnum<{
        outreach: "outreach";
        fallback_candidate: "fallback_candidate";
    }>;
    decisionId: z.ZodString;
    candidateId: z.ZodString;
    judgmentVerdict: z.ZodEnum<{
        allow: "allow";
        deny: "deny";
        defer: "defer";
    }>;
    valueScore: z.ZodNumber;
    interestRefs: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<{
            platform_item: "platform_item";
            workspace_artifact: "workspace_artifact";
            decision_record: "decision_record";
            user_anchor: "user_anchor";
            connector_result: "connector_result";
            host_report: "host_report";
            fallback_artifact: "fallback_artifact";
        }>;
        uri: z.ZodString;
        excerptHash: z.ZodOptional<z.ZodString>;
        observedAt: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type SceneGuidanceRequest = z.infer<typeof sceneGuidanceRequestSchema>;
export type OutreachDraftRequest = z.infer<typeof outreachDraftRequestSchema>;
export type DeliveryExpressionContext = z.infer<typeof deliveryExpressionContextSchema>;
export declare function parseOutreachDraftRequest(input: unknown): OutreachDraftRequest;
export declare function safeParseOutreachDraftRequest(input: unknown): z.ZodSafeParseResult<{
    requestId: string;
    runtimeScope: "rhythm" | "user_reply" | "user_task";
    riskLevel: "low" | "medium" | "high";
    sourceRefs: {
        id: string;
        kind: "platform_item" | "workspace_artifact" | "decision_record" | "user_anchor" | "connector_result" | "host_report" | "fallback_artifact";
        uri: string;
        excerptHash?: string | undefined;
        observedAt?: string | undefined;
    }[];
    sceneType: "outreach" | "fallback_candidate";
    decisionId: string;
    candidateId: string;
    judgmentVerdict: "allow" | "deny" | "defer";
    valueScore: number;
    interestRefs: {
        id: string;
        kind: "platform_item" | "workspace_artifact" | "decision_record" | "user_anchor" | "connector_result" | "host_report" | "fallback_artifact";
        uri: string;
        excerptHash?: string | undefined;
        observedAt?: string | undefined;
    }[];
    rhythmWindowKind?: "quiet" | "social" | "work" | "exploration" | "reflection" | "maintenance" | undefined;
    deliveryContext?: {
        deliveryVerdict: "target_none" | "channel_missing" | "host_unsupported" | "delivery_failed" | "target_available";
        wordingMode: "sendable" | "not_sent_fallback_candidate";
        fallbackRef?: string | undefined;
    } | undefined;
    language?: "en-US" | "zh-CN" | undefined;
}>;
/** Async seam for generative outreach copy (implementation lives outside control-plane). */
export interface GuidanceDraftPort {
    draftOutreachMessage(request: OutreachDraftRequest): Promise<{
        status: "ready";
        draft: {
            text: string;
            deliveryWording: DeliveryExpressionContext["wordingMode"];
        };
    } | {
        status: "unavailable";
        reasons: string[];
    }>;
}
