export interface ReflectionAudit {
    id: string;
    modelEvalRef?: string;
    claimCount: number;
    unsupportedClaimCount: number;
    sourceCoverageRatio: number;
    reflectionDebt?: number;
    starved?: boolean;
}
export interface ReflectionAuditProjection {
    eventId: string;
    unsupportedClaimCount: number;
    sourceCoverageRatio: number;
    claimCount: number;
    modelEvalRef?: string;
}
export declare function projectReflectionAudit(input: ReflectionAudit): ReflectionAuditProjection;
