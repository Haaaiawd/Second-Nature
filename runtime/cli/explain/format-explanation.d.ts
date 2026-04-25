import type { ExplainReadModel } from "../read-models/types.js";
export interface FormattedExplanation {
    subjectType: ExplainReadModel["subjectType"];
    conclusion: string;
    keyFactors: string[];
    evidenceRefs: string[];
    requiredUserInput?: string[];
    nextStep?: string;
}
export declare function formatExplanation(model: ExplainReadModel): FormattedExplanation;
