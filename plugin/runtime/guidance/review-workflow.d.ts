import type { TemplateReviewStatus } from "./types.js";
export interface GuidanceTemplateReviewItem {
    templateId: string;
    relativePath: string;
    scope: string;
    scene?: string;
    reviewRequired: boolean;
    reviewStatus: TemplateReviewStatus;
    nextAction: "human_review_required" | "ready_for_runtime_use" | "revise_template";
}
export interface GuidanceReviewChecklist {
    generatedAt: string;
    items: GuidanceTemplateReviewItem[];
}
export declare function collectGuidanceReviewChecklist(): Promise<GuidanceReviewChecklist>;
