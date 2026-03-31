import type { OutreachEvaluationResult } from "../../../shared/types/outreach.js";
export interface OutreachMessage {
    style: "intent_level_guidance";
    maxSentences: 3;
    avoidFormats: Array<"ticket" | "daily_report" | "status_broadcast">;
    intent: {
        whyNow: string;
        coreMeaning: string;
        deliveryBoundary: string[];
        soulAlignment: string;
    };
}
export declare function buildOutreachMessage(input: {
    summary: string;
    evaluation: OutreachEvaluationResult;
}): OutreachMessage;
