export interface OutreachEvaluationInput {
    candidateId: string;
    summary: string;
    sourceRefs: string[];
    recentOutreachHashes: string[];
    requiredUserHelp?: boolean;
}
export interface OutreachEvaluationResult {
    valueScore: number;
    novelty: number;
    userRelevance: number;
    actionability: number;
    urgency: number;
    requiredUserHelp: boolean;
    isRoutineProgress: boolean;
    minThreshold: number;
    sourceRefs: string[];
    explanation?: string;
}
