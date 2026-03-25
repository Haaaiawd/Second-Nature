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

export function projectReflectionAudit(input: ReflectionAudit): ReflectionAuditProjection {
  return {
    eventId: input.id,
    unsupportedClaimCount: input.unsupportedClaimCount,
    sourceCoverageRatio: input.sourceCoverageRatio,
    claimCount: input.claimCount,
    modelEvalRef: input.modelEvalRef,
  };
}
