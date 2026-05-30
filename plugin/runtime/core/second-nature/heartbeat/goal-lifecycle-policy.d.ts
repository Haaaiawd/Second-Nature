export interface GoalTransitionRequest {
    goalId: string;
    newStatus: "completed" | "expired" | "replaced" | "paused" | "accepted";
    reason: string;
    updatedAt: string;
}
/** Minimal goal shape required by the lifecycle policy evaluator. */
export interface EvaluableGoal {
    goalId: string;
    kind?: string;
    scope?: string;
    status: string;
    updatedAt?: string;
    expiresAt?: string;
}
export interface GoalLifecyclePolicyResult {
    activeGoals: EvaluableGoal[];
    transitionRequests: GoalTransitionRequest[];
    evaluatedAt: string;
}
export interface GoalLifecyclePolicy {
    evaluate(goals: EvaluableGoal[]): GoalLifecyclePolicyResult;
}
export declare function createGoalLifecyclePolicy(): GoalLifecyclePolicy;
