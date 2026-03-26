import type { ExplainReadModel } from "../read-models/types.js";

export interface FormattedExplanation {
  subjectType: ExplainReadModel["subjectType"];
  conclusion: string;
  keyFactors: string[];
  evidenceRefs: string[];
  requiredUserInput?: string[];
  nextStep?: string;
}

export function formatExplanation(model: ExplainReadModel): FormattedExplanation {
  return {
    subjectType: model.subjectType,
    conclusion: model.conclusion,
    keyFactors: model.keyFactors,
    evidenceRefs: model.evidenceRefs,
    requiredUserInput: model.requiredUserInput,
    nextStep: model.nextStep,
  };
}
